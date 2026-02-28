import { NextResponse } from "next/server";
import { createPublicClient, http, decodeEventLog } from "viem";
import { monadTestnet } from "viem/chains";
import { prisma } from "@/lib/prisma";

const publicClient = createPublicClient({
	chain: monadTestnet,
	transport: http(
		process.env.NEXT_PUBLIC_MONAD_RPC_URL ||
			"https://testnet-rpc.monad.xyz",
	),
});

const POOL_CREATED_ABI = [
	{
		type: "event" as const,
		name: "PoolCreated",
		inputs: [
			{ name: "poolId", type: "uint256", indexed: true },
			{ name: "question", type: "string", indexed: false },
			{ name: "closeTime", type: "uint256", indexed: false },
		],
	},
];

export async function POST(req: Request) {
	try {
		const { txHash, sourceTweetId } = (await req.json()) as {
			txHash: string;
			sourceTweetId?: string;
		};
		if (!txHash || typeof txHash !== "string") {
			return NextResponse.json(
				{ error: "txHash required" },
				{ status: 400 },
			);
		}

		const receipt = await publicClient.getTransactionReceipt({
			hash: txHash as `0x${string}`,
		});
		if (!receipt || receipt.status !== "success") {
			return NextResponse.json(
				{ error: "Invalid or failed transaction" },
				{ status: 400 },
			);
		}

		for (const log of receipt.logs) {
			try {
				const decoded = decodeEventLog({
					abi: POOL_CREATED_ABI,
					data: log.data,
					topics: log.topics,
				});
				if (decoded.eventName === "PoolCreated") {
					const { poolId, question, closeTime } = decoded.args as {
						poolId: bigint;
						question: string;
						closeTime: bigint;
					};
					const sid = sourceTweetId && String(sourceTweetId).trim() ? String(sourceTweetId).trim() : undefined;
					await prisma.pool.upsert({
						where: { id: poolId.toString() },
						create: {
							id: poolId.toString(),
							question,
							closeTime: new Date(Number(closeTime) * 1000),
							resolved: false,
							createdBy: receipt.from,
							sourceTweetId: sid ?? undefined,
						},
						update: sid !== undefined ? { sourceTweetId: sid } : {},
					});
					return NextResponse.json({ poolId: poolId.toString() });
				}
			} catch {
				// skip non-PoolCreated logs
			}
		}

		return NextResponse.json(
			{ error: "No PoolCreated event in tx" },
			{ status: 400 },
		);
	} catch (e) {
		console.error("[api/pools/sync] error:", e);
		return NextResponse.json({ error: "Sync failed" }, { status: 500 });
	}
}
