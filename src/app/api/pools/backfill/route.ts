import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { syncPoolFromChain } from "@/lib/sync-pool";

/**
 * POST /api/pools/backfill
 * Syncs orphan ProcessedMentions (pools created on-chain but not in DB) to the Pool table.
 * Call after fixing sync issues to backfill missing pools.
 */
export async function POST() {
	try {
		const processed = await prisma.processedMention.findMany();
		const synced: string[] = [];
		const skipped: string[] = [];

		for (const pm of processed) {
			const existing = await prisma.pool.findUnique({
				where: { id: pm.poolId },
			});
			if (existing) {
				skipped.push(pm.poolId);
				continue;
			}
			const result = await syncPoolFromChain(pm.poolId, pm.tweetId);
			if (result) synced.push(pm.poolId);
		}

		return NextResponse.json({
			ok: true,
			synced,
			skipped,
			total: processed.length,
		});
	} catch (e) {
		console.error("[api/pools/backfill] error:", e);
		return NextResponse.json(
			{ error: String(e), ok: false },
			{ status: 500 },
		);
	}
}
