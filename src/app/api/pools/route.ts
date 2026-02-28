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

export async function GET() {
	try {
		const nextId = await publicClient.readContract({
			address: CONTRACT_ADDRESS,
			abi: MONHARD_ABI,
			functionName: "nextPoolId",
		});

		const pools: Array<{
			id: string;
			question: string;
			closeTime: string;
			totalYes: string;
			totalNo: string;
			resolved: boolean;
			winningSide: boolean | null;
			creator: string;
		}> = [];

		for (let i = 1; i < Number(nextId); i++) {
			const p = await publicClient.readContract({
				address: CONTRACT_ADDRESS,
				abi: MONHARD_ABI,
				functionName: "pools",
				args: [BigInt(i)],
			});
			if (p && p[1]) {
				pools.push({
					id: String(i),
					question: p[1],
					closeTime: new Date(Number(p[2]) * 1000).toISOString(),
					totalYes: p[3].toString(),
					totalNo: p[4].toString(),
					resolved: p[5],
					winningSide: p[5] ? p[6] : null,
					creator: p[7],
				});
			}
		}

		return NextResponse.json(pools);
	} catch (e) {
		console.error("[api/pools] error:", e);
		const dbPools = await prisma.pool.findMany({
			orderBy: { closeTime: "desc" },
		});
		return NextResponse.json(
			dbPools.map((p) => ({
				id: p.id,
				question: p.question,
				closeTime: p.closeTime.toISOString(),
				totalYes: "0",
				totalNo: "0",
				resolved: p.resolved,
				winningSide: p.winningSide,
				creator: p.createdBy,
			})),
		);
	}
}
