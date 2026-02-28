import { NextResponse } from "next/server";
import {
	getWriteClient,
	getXUserMentions,
	isXConfigured,
	isXReadConfigured,
	type XTweet,
} from "@/lib/x-api";
import { createPoolOnChain } from "@/lib/create-pool";
import { prisma } from "@/lib/prisma";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
const DEFAULT_CLOSE_HOURS = 24 * 7; // 7 days

/**
 * Extracts a betting question from tweet text.
 * Removes @mentions and trims. Falls back to "Will this happen?" if empty.
 */
function parseQuestionFromTweet(text: string): string {
	// Remove @mentions (e.g. @MonHard @CanIBetOn)
	let q = text.replace(/@\w+/g, "").trim();
	// Remove extra whitespace
	q = q.replace(/\s+/g, " ").trim();
	if (!q || q.length < 3) return "Will this happen?";
	if (q.length > 200) q = q.slice(0, 197) + "...";
	return q;
}

/** Fetch mentions via api.x.com/2 (Bearer) or SDK (OAuth). Returns list of tweets. */
async function fetchMentions(botUserId: string): Promise<XTweet[]> {
	if (isXReadConfigured()) {
		const res = await getXUserMentions(botUserId, { max_results: 20 });
		if (res.errors?.length) {
			throw new Error(res.errors.map((e) => e.message).join("; "));
		}
		return res.data ?? [];
	}
	const client = getWriteClient();
	if (!client) return [];
	const mentions = await client.v2.userMentionTimeline(botUserId, {
		max_results: 20,
		"tweet.fields": ["created_at", "author_id", "text"],
		expansions: ["author_id"],
	});
	return (mentions.data?.data ?? []) as XTweet[];
}

/**
 * GET /api/x/mentions
 * Polls X for new mentions (api.x.com/2), creates pools, replies with links.
 * Call from cron (e.g. Vercel Cron every 10 min) or manually.
 *
 * Read: X_API_BEARER_TOKEN or BEARER_TOKEN (per https://docs.x.com/x-api/getting-started/make-your-first-request)
 * Write: X_API_KEY, X_API_SECRET, X_ACCESS_TOKEN, X_ACCESS_TOKEN_SECRET (OAuth 1.0a for posting)
 * Requires: OWNER_PRIVATE_KEY, X_BOT_USER_ID, NEXT_PUBLIC_APP_URL
 * Optional: CRON_SECRET - when set, Vercel sends it as Bearer token; reject if missing
 */
export async function GET(req: Request) {
	const cronSecret = process.env.CRON_SECRET;
	if (cronSecret) {
		const token = req.headers
			.get("authorization")
			?.replace(/^Bearer\s+/i, "");
		if (token !== cronSecret) {
			return NextResponse.json(
				{ error: "Unauthorized" },
				{ status: 401 },
			);
		}
	}
	// Need write client to post replies; mentions can come from Bearer or OAuth
	if (!isXConfigured()) {
		return NextResponse.json(
			{ error: "X API not configured (OAuth for posting required)", ok: false },
			{ status: 503 },
		);
	}

	const botUserId = process.env.X_BOT_USER_ID;
	if (!botUserId) {
		return NextResponse.json(
			{ error: "X_BOT_USER_ID not configured", ok: false },
			{ status: 503 },
		);
	}

	const writeClient = getWriteClient();
	if (!writeClient) {
		return NextResponse.json(
			{ error: "X API write client failed (OAuth credentials required)", ok: false },
			{ status: 503 },
		);
	}

	try {
		const tweets = await fetchMentions(botUserId);
		const created: Array<{ tweetId: string; poolId: string }> = [];

		// Debug: log how many mentions we got
		console.log("[x/mentions] fetched", tweets.length, "mentions for user", botUserId);

		for (const tweet of tweets) {
			const tweetId = tweet.id;
			const text = tweet.text ?? "";

			// Skip if already processed
			const existing = await prisma.processedMention.findUnique({
				where: { tweetId },
			});
			if (existing) continue;

			const question = parseQuestionFromTweet(text);
			const closeTime = Math.floor(
				Date.now() / 1000 + DEFAULT_CLOSE_HOURS * 60 * 60,
			);

			const result = await createPoolOnChain(question, closeTime);
			if (!result) {
				console.error(
					"[x/mentions] createPool failed for tweet",
					tweetId,
				);
				continue;
			}

			const { poolId, txHash } = result;

			// Sync to DB (include source tweet for X API fetch / "view tweet" link)
			await fetch(`${APP_URL}/api/pools/sync`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ txHash, sourceTweetId: tweetId }),
			}).catch(() => {});

			// Mark as processed
			await prisma.processedMention.create({
				data: { tweetId, poolId },
			});

			// Reply with pool link
			const poolUrl = `${APP_URL}/bet/${poolId}`;
			const replyText = `Pool created! Bet Yes or No: ${poolUrl}`;

			try {
				await writeClient.v2.tweet(replyText, {
					reply: { in_reply_to_tweet_id: tweetId },
				});
			} catch (replyErr) {
				console.error(
					"[x/mentions] reply failed for tweet",
					tweetId,
					replyErr,
				);
			}

			created.push({ tweetId, poolId });
		}

		return NextResponse.json({
			ok: true,
			fetched: tweets.length,
			processed: created.length,
			created,
		});
	} catch (e) {
		console.error("[x/mentions] error:", e);
		return NextResponse.json(
			{ error: String(e), ok: false },
			{ status: 500 },
		);
	}
}
