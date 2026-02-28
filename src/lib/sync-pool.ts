import { createPublicClient, http, decodeEventLog } from "viem";
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

/**
 * Syncs a pool from chain tx to DB. Call directly (no HTTP fetch).
 */
export async function syncPoolFromTx(
	txHash: string,
	sourceTweetId?: string,
): Promise<{ poolId: string } | null> {
	const receipt = await publicClient.getTransactionReceipt({
		hash: txHash as `0x${string}`,
	});
	if (!receipt || receipt.status !== "success") return null;

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
				const sid =
					sourceTweetId && String(sourceTweetId).trim()
						? String(sourceTweetId).trim()
						: undefined;
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
				return { poolId: poolId.toString() };
			}
		} catch {
			// skip non-PoolCreated logs
		}
	}
	return null;
}

/**
 * Syncs a pool from chain by poolId (for backfilling orphan ProcessedMentions).
 */
export async function syncPoolFromChain(
	poolId: string,
	sourceTweetId?: string,
): Promise<{ poolId: string } | null> {
	try {
		const p = await publicClient.readContract({
			address: CONTRACT_ADDRESS,
			abi: MONHARD_ABI,
			functionName: "pools",
			args: [BigInt(poolId)],
		});
		if (!p || p[0] === 0n) return null; // Pool doesn't exist

		const [id, question, closeTime, , , resolved, winningSide, creator] = p;
		const sid =
			sourceTweetId && String(sourceTweetId).trim()
				? String(sourceTweetId).trim()
				: undefined;

		await prisma.pool.upsert({
			where: { id: poolId },
			create: {
				id: poolId,
				question,
				closeTime: new Date(Number(closeTime) * 1000),
				resolved: resolved ?? false,
				winningSide: resolved ? winningSide ?? null : null,
				createdBy: creator ?? "0x0",
				sourceTweetId: sid ?? undefined,
			},
			update: {
				question,
				closeTime: new Date(Number(closeTime) * 1000),
				resolved: resolved ?? false,
				winningSide: resolved ? winningSide ?? null : null,
				...(sid !== undefined && { sourceTweetId: sid }),
			},
		});
		return { poolId };
	} catch {
		return null;
	}
}

/**
 * Syncs all pools from chain to DB (reads nextPoolId, syncs 1..nextPoolId-1).
 */
export async function syncAllPoolsFromChain(): Promise<string[]> {
	if (
		!CONTRACT_ADDRESS ||
		CONTRACT_ADDRESS === "0x0000000000000000000000000000000000000000"
	) {
		throw new Error("NEXT_PUBLIC_CONTRACT_ADDRESS not configured");
	}
	const nextId = await publicClient.readContract({
		address: CONTRACT_ADDRESS,
		abi: MONHARD_ABI,
		functionName: "nextPoolId",
		args: [],
	});
	const maxId = Number(nextId ?? 0);
	const synced: string[] = [];
	for (let id = 1; id < maxId; id++) {
		const result = await syncPoolFromChain(String(id));
		if (result) synced.push(result.poolId);
	}
	return synced;
}
