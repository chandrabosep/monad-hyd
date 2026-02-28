import { NextResponse } from "next/server";
import {
	syncAllPoolsFromChain,
	syncPoolFromChain,
	syncPoolFromTx,
} from "@/lib/sync-pool";

/**
 * POST /api/pools/sync
 * Sync pools to DB. Provide:
 * - poolId: "all" → sync all pools from chain
 * - poolId: "5" → sync single pool by ID
 * - txHash: sync from transaction receipt (+ optional sourceTweetId)
 */
export async function POST(req: Request) {
	try {
		const body = ((await req.json().catch(() => ({}))) ?? {}) as {
			poolId?: string;
			txHash?: string;
			sourceTweetId?: string;
		};

		if (body.poolId === "all") {
			const synced = await syncAllPoolsFromChain();
			return NextResponse.json({ synced, count: synced.length });
		}

		if (body.poolId && typeof body.poolId === "string") {
			const result = await syncPoolFromChain(
				body.poolId,
				body.sourceTweetId,
			);
			if (result) {
				return NextResponse.json({ poolId: result.poolId });
			}
			return NextResponse.json(
				{ error: "Pool not found on chain" },
				{ status: 400 },
			);
		}

		const { txHash, sourceTweetId } = body;
		if (!txHash || typeof txHash !== "string") {
			return NextResponse.json(
				{ error: "poolId or txHash required" },
				{ status: 400 },
			);
		}

		const result = await syncPoolFromTx(txHash, sourceTweetId);
		if (result) {
			return NextResponse.json({ poolId: result.poolId });
		}
		return NextResponse.json(
			{ error: "No PoolCreated event in tx" },
			{ status: 400 },
		);
	} catch (e) {
		const msg = e instanceof Error ? e.message : String(e);
		console.error("[api/pools/sync] error:", e);
		return NextResponse.json(
			{ error: "Sync failed", details: msg },
			{ status: 500 },
		);
	}
}
