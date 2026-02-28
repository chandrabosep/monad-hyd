import { NextResponse } from "next/server";
import {
	getWriteClient,
	getXUserMentions,
	isXConfigured,
	isXReadConfigured,
} from "@/lib/x-api";
import { createPoolOnChain } from "@/lib/create-pool";
import { syncPoolFromChain, syncPoolFromTx } from "@/lib/sync-pool";
import { tweetToQuestion, questionToOptions } from "@/lib/tweet-to-question";
import { prisma } from "@/lib/prisma";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
const DEFAULT_CLOSE_HOURS = 24 * 7; // 7 days
/** Only process tweets that mention this handle (e.g. @mooonhard) */
const BOT_MENTION_HANDLE = (process.env.X_BOT_HANDLE || "mooonhard").toLowerCase();

type WriteClient = NonNullable<ReturnType<typeof getWriteClient>>;

/**
 * Try to post as a direct reply. If X blocks it (403 — restricted replies,
 * private account, bot not in conversation), fall back to a quote tweet so
 * the pool link is always visible on X.
 */
async function postReply(
	client: WriteClient,
	text: string,
	tweetId: string,
): Promise<"replied" | "quoted" | "failed"> {
	try {
		await client.v2.tweet(text, { reply: { in_reply_to_tweet_id: tweetId } });
		return "replied";
	} catch (err: unknown) {
		const e = err as { data?: { status?: number }; code?: number };
		const status = e?.data?.status ?? e?.code;
		if (status !== 403) {
			console.error("[x/mentions] reply failed for tweet", tweetId, JSON.stringify(e?.data ?? String(err)));
			return "failed";
		}
	}

	// 403 fallback — quote the mention tweet instead
	try {
		await client.v2.tweet(text, { quote_tweet_id: tweetId });
		console.log("[x/mentions] reply blocked; posted as quote tweet for", tweetId);
		return "quoted";
	} catch (qErr: unknown) {
		const qe = qErr as { data?: unknown };
		console.error("[x/mentions] quote tweet fallback also failed for", tweetId, JSON.stringify(qe?.data ?? String(qErr)));
		return "failed";
	}
}

/**
 * GET /api/x/mentions
 * Polls X for new mentions (api.x.com/2), creates pools, replies with links.
 * Call from cron (e.g. Vercel Cron every 10 min) or manually.
 *
 * Read: X_API_BEARER_TOKEN or BEARER_TOKEN (per https://docs.x.com/x-api/getting-started/make-your-first-request)
 * Write: X_API_KEY, X_API_SECRET, X_ACCESS_TOKEN, X_ACCESS_TOKEN_SECRET (OAuth 1.0a for posting)
 * Requires: OWNER_PRIVATE_KEY, X_BOT_USER_ID, NEXT_PUBLIC_APP_URL
 * Optional: GROQ_API_KEY - when set, AI converts tweet to yes/no question; else fallback parse
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
		// Fetch mentions from X API (not DB) - tweet text comes from X
		const mentionsRes = await (async () => {
			if (isXReadConfigured()) {
				const res = await getXUserMentions(botUserId, { max_results: 20 });
				if (res.errors?.length) throw new Error(res.errors.map((e) => e.message).join("; "));
				return res;
			}
			const client = getWriteClient();
			if (!client) return { data: [], includes: undefined };
			const mentions = await client.v2.userMentionTimeline(botUserId, {
				max_results: 20,
				"tweet.fields": ["created_at", "author_id", "text", "referenced_tweets"],
				expansions: ["author_id", "referenced_tweets.id"],
			});
			return { data: (mentions.data?.data ?? []) as import("@/lib/x-api").XTweet[], includes: (mentions.data?.includes as { tweets?: import("@/lib/x-api").XTweet[] }) };
		})();
		const tweets = mentionsRes.data ?? [];
		/** Lookup map for expanded referenced tweets keyed by tweet ID */
		const includedTweets = new Map<string, string>(
			(mentionsRes.includes?.tweets ?? []).map((t) => [t.id, t.text ?? ""]),
		);
		const created: Array<{ tweetId: string; poolId: string }> = [];

		console.log("[x/mentions] fetched", tweets.length, "mentions for user", botUserId);

		for (const tweet of tweets) {
			const tweetId = tweet.id;
			const mentionText = tweet.text ?? "";

			// Build full context: mention text + any referenced tweet content (reply/quote)
			const referencedContent = (tweet.referenced_tweets ?? [])
				.filter((r) => r.type === "replied_to" || r.type === "quoted")
				.map((r) => includedTweets.get(r.id) ?? "")
				.filter(Boolean)
				.join(" ");
			const text = referencedContent
				? `${mentionText} ${referencedContent}`
				: mentionText;

			// Only process tweets that mention mooonhard (or configured handle)
			if (!text.toLowerCase().includes(BOT_MENTION_HANDLE)) {
				continue;
			}

			const existing = await prisma.processedMention.findUnique({
				where: { tweetId },
			});

			// Already processed and replied - skip
			if (existing?.repliedAt) continue;

			// Have pool but reply failed before - retry reply only
			if (existing) {
				const pool = await prisma.pool.findUnique({
					where: { id: existing.poolId },
				});
				if (pool) {
					const { optionA, optionB } = await questionToOptions(pool.question);
					const poolUrl = `${APP_URL}/pools/${existing.poolId}`;
					const replyText = `Q: ${pool.question}\nA) ${optionA}\nB) ${optionB}\n\nPlace your bets: ${poolUrl}`;
					const outcome = await postReply(writeClient, replyText, tweetId);
					if (outcome !== "failed") {
						await prisma.processedMention.update({
							where: { tweetId },
							data: { repliedAt: new Date() },
						});
						created.push({ tweetId, poolId: existing.poolId });
					}
				}
				continue;
			}

			const question = await tweetToQuestion(text);
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

			// Sync to DB (try tx first, fallback to chain read)
			let synced = await syncPoolFromTx(txHash, tweetId);
			if (!synced) {
				synced = await syncPoolFromChain(poolId, tweetId);
			}
			if (!synced) {
				console.error("[x/mentions] sync to DB failed for tx", txHash);
				continue; // Don't mark as processed if pool wasn't synced to DB
			}

			// Reply with formatted Q/A and pool link (before marking processed so we retry if reply fails)
			const { optionA, optionB } = await questionToOptions(question);
			const poolUrl = `${APP_URL}/pools/${poolId}`;
			const replyText = `Q: ${question}\nA) ${optionA}\nB) ${optionB}\n\nPlace your bets: ${poolUrl}`;

			const outcome = await postReply(writeClient, replyText, tweetId);
			if (outcome === "failed") {
				// Transient failure — save pool without repliedAt so we retry the post next cron
				await prisma.processedMention.create({
					data: { tweetId, poolId },
				});
				continue;
			}

			await prisma.processedMention.create({
				data: { tweetId, poolId, repliedAt: new Date() },
			});

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
