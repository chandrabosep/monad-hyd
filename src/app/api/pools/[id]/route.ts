import { NextResponse } from "next/server";
import { createPublicClient, http } from "viem";
import { monadTestnet } from "viem/chains";
import { prisma } from "@/lib/prisma";

/** X tweet URL for "view original" when pool was created from a mention */
export function tweetUrl(tweetId: string): string {
	return `https://x.com/i/status/${tweetId}`;
}
import { CONTRACT_ADDRESS, MONHARD_ABI } from "@/lib/contract";

const publicClient = createPublicClient({
	chain: monadTestnet,
	transport: http(
		process.env.NEXT_PUBLIC_MONAD_RPC_URL ||
			"https://testnet-rpc.monad.xyz",
	),
});

export async function GET(
	_req: Request,
	{ params }: { params: Promise<{ id: string }> },
) {
	const { id } = await params;
	const poolId = BigInt(id);

	try {
		const p = await publicClient.readContract({
			address: CONTRACT_ADDRESS,
			abi: MONHARD_ABI,
			functionName: "pools",
			args: [poolId],
		});

		const dbPool = await prisma.pool.findUnique({ where: { id } }).catch(() => null);

		if (!p || !p[1]) {
			if (dbPool) {
				return NextResponse.json({
					id: dbPool.id,
					question: dbPool.question,
					closeTime: dbPool.closeTime.toISOString(),
					totalYes: "0",
					totalNo: "0",
					resolved: dbPool.resolved,
					winningSide: dbPool.winningSide,
					creator: dbPool.createdBy,
					sourceTweetId: dbPool.sourceTweetId ?? undefined,
					sourceTweetUrl: dbPool.sourceTweetId ? tweetUrl(dbPool.sourceTweetId) : undefined,
				});
			}
			return NextResponse.json(
				{ error: "Pool not found" },
				{ status: 404 },
			);
		}

		return NextResponse.json({
			id,
			question: p[1],
			closeTime: new Date(Number(p[2]) * 1000).toISOString(),
			totalYes: p[3].toString(),
			totalNo: p[4].toString(),
			resolved: p[5],
			winningSide: p[5] ? p[6] : null,
			creator: p[7],
			sourceTweetId: dbPool?.sourceTweetId ?? undefined,
			sourceTweetUrl: dbPool?.sourceTweetId ? tweetUrl(dbPool.sourceTweetId) : undefined,
		});
	} catch (e) {
		console.error("[api/pools/[id]] error:", e);
		const dbPool = await prisma.pool.findUnique({ where: { id } }).catch(() => null);
		if (dbPool) {
			return NextResponse.json({
				id: dbPool.id,
				question: dbPool.question,
				closeTime: dbPool.closeTime.toISOString(),
				totalYes: "0",
				totalNo: "0",
				resolved: dbPool.resolved,
				winningSide: dbPool.winningSide,
				creator: dbPool.createdBy,
				sourceTweetId: dbPool.sourceTweetId ?? undefined,
				sourceTweetUrl: dbPool.sourceTweetId ? tweetUrl(dbPool.sourceTweetId) : undefined,
			});
		}
		return NextResponse.json({ error: "Pool not found" }, { status: 404 });
	}
}
