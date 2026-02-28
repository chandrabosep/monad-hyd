import { NextResponse } from "next/server";
import { createPublicClient, http } from "viem";
import { monadTestnet } from "viem/chains";
import { prisma } from "@/lib/prisma";
import { CONTRACT_ADDRESS, MONHARD_ABI } from "@/lib/contract";

/** X tweet URL for "view original" when pool was created from a mention */
function tweetUrl(tweetId: string): string {
	return `https://x.com/i/status/${tweetId}`;
}

const publicClient = createPublicClient({
	chain: monadTestnet,
	transport: http(
		process.env.NEXT_PUBLIC_MONAD_RPC_URL ||
			"https://testnet-rpc.monad.xyz",
	),
});

/**
 * GET /api/pools/[id]
 * Uses DB as primary source (question, closeTime, etc). Fetches totals from chain only.
 */
export async function GET(
	_req: Request,
	{ params }: { params: Promise<{ id: string }> },
) {
	const { id } = await params;

	try {
		const dbPool = await prisma.pool.findUnique({ where: { id } });
		if (!dbPool) {
			return NextResponse.json(
				{ error: "Pool not found" },
				{ status: 404 },
			);
		}

		// Fetch live totals from chain (totalYes, totalNo change when users bet)
		let totalYes = "0";
		let totalNo = "0";
		let resolved = dbPool.resolved;
		let winningSide = dbPool.winningSide;
		try {
			const p = await publicClient.readContract({
				address: CONTRACT_ADDRESS,
				abi: MONHARD_ABI,
				functionName: "pools",
				args: [BigInt(id)],
			});
			if (p && p[1]) {
				totalYes = p[3].toString();
				totalNo = p[4].toString();
				resolved = p[5];
				winningSide = p[5] ? p[6] : null;
			}
		} catch {
			// use DB values for totals
		}

		return NextResponse.json({
			id: dbPool.id,
			question: dbPool.question,
			closeTime: dbPool.closeTime.toISOString(),
			totalYes,
			totalNo,
			resolved,
			winningSide,
			creator: dbPool.createdBy,
			sourceTweetId: dbPool.sourceTweetId ?? undefined,
			sourceTweetUrl: dbPool.sourceTweetId ? tweetUrl(dbPool.sourceTweetId) : undefined,
		});
	} catch (e) {
		console.error("[api/pools/[id]] error:", e);
		return NextResponse.json({ error: "Pool not found" }, { status: 404 });
	}
}
