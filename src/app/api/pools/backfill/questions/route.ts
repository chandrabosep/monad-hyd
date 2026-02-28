import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getXTweet, type XTweet } from "@/lib/x-api";
import { tweetToQuestion } from "@/lib/tweet-to-question";

const GENERIC_QUESTION = "Will this happen?";

/**
 * POST /api/pools/backfill/questions
 * Fixes pools with generic "Will this happen?" by re-fetching the tweet and
 * re-extracting the question. Updates DB only (chain question stays as-is).
 * Requires: X_API_BEARER_TOKEN (or BEARER_TOKEN) for fetching tweets.
 */
export async function POST() {
	try {
		const pools = await prisma.pool.findMany({
			where: {
				question: GENERIC_QUESTION,
				sourceTweetId: { not: null },
			},
		});

		const updated: string[] = [];
		const skipped: string[] = [];

		for (const pool of pools) {
			const tweetId = pool.sourceTweetId;
			if (!tweetId) continue;

			try {
				const res = await getXTweet(tweetId, ["text"]);
				const tweet = res.data as XTweet | XTweet[] | undefined;
				const text = Array.isArray(tweet) ? tweet[0]?.text : tweet?.text;
				if (!text?.trim()) {
					skipped.push(pool.id);
					continue;
				}

				const newQuestion = await tweetToQuestion(text);
				if (!newQuestion || newQuestion === GENERIC_QUESTION) {
					skipped.push(pool.id);
					continue;
				}

				await prisma.pool.update({
					where: { id: pool.id },
					data: { question: newQuestion.slice(0, 200) },
				});
				updated.push(pool.id);
			} catch {
				skipped.push(pool.id);
			}
		}

		return NextResponse.json({
			ok: true,
			updated,
			skipped,
			total: pools.length,
		});
	} catch (e) {
		console.error("[api/pools/backfill/questions] error:", e);
		return NextResponse.json(
			{ error: String(e), ok: false },
			{ status: 500 },
		);
	}
}
