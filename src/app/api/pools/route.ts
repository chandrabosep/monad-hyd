import { NextResponse } from "next/server";
import { createPublicClient, http } from "viem";
import { monadTestnet } from "viem/chains";
import { prisma } from "@/lib/prisma";
import { CONTRACT_ADDRESS, MONHARD_ABI } from "@/lib/contract";

const publicClient = createPublicClient({
	chain: monadTestnet,
	transport: http(
		process.env.NEXT_PUBLIC_MONAD_RPC_URL ||
			"https://testnet-rpc.monad.xyz",
	),
});

/** Fetch totalYes/totalNo from chain for a pool */
async function getChainTotals(poolId: string) {
	try {
		const p = await publicClient.readContract({
			address: CONTRACT_ADDRESS,
			abi: MONHARD_ABI,
			functionName: "pools",
			args: [BigInt(poolId)],
		});
		if (p && p[1]) {
			return {
				totalYes: p[3].toString(),
				totalNo: p[4].toString(),
				resolved: p[5],
				winningSide: p[5] ? p[6] : null,
			};
		}
	} catch {
		// ignore
	}
	return { totalYes: "0", totalNo: "0", resolved: false, winningSide: null };
}

/**
 * GET /api/pools
 * Uses DB as primary source (question, closeTime, etc). Fetches totals from chain only.
 */
export async function GET() {
	try {
		const dbPools = await prisma.pool.findMany({
			orderBy: { closeTime: "desc" },
		});

		const pools = await Promise.all(
			dbPools.map(async (p) => {
				const chain = await getChainTotals(p.id);
				return {
					id: p.id,
					question: p.question,
					closeTime: p.closeTime.toISOString(),
					totalYes: chain.totalYes,
					totalNo: chain.totalNo,
					resolved: chain.resolved ?? p.resolved,
					winningSide: chain.winningSide ?? p.winningSide,
					creator: p.createdBy,
				};
			}),
		);

		return NextResponse.json(pools);
	} catch (e) {
		console.error("[api/pools] error:", e);
		return NextResponse.json([], { status: 500 });
	}
}
