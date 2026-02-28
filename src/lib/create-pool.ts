import { createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { monadTestnet } from "viem/chains";
import { CONTRACT_ADDRESS, MONHARD_ABI } from "./contract";

const rpcUrl =
	process.env.NEXT_PUBLIC_MONAD_RPC_URL || "https://testnet-rpc.monad.xyz";

/**
 * Creates a pool on-chain using the owner private key.
 * Used by X mention flow (server-side).
 */
export async function createPoolOnChain(
	question: string,
	closeTime: number,
): Promise<{ poolId: string; txHash: string } | null> {
	const pk = process.env.OWNER_PRIVATE_KEY;
	if (!pk || !pk.startsWith("0x")) {
		console.error("[create-pool] OWNER_PRIVATE_KEY not configured");
		return null;
	}

	const account = privateKeyToAccount(pk as `0x${string}`);
	const client = createWalletClient({
		account,
		chain: monadTestnet,
		transport: http(rpcUrl),
	});

	const hash = await client.writeContract({
		address: CONTRACT_ADDRESS,
		abi: MONHARD_ABI,
		functionName: "createPool",
		args: [question, BigInt(closeTime)],
	});

	if (!hash) return null;

	// Parse poolId from event (nextPoolId - 1) - we'd need to wait for receipt
	// Simpler: read nextPoolId before tx, poolId = nextPoolId after
	const { createPublicClient } = await import("viem");
	const publicClient = createPublicClient({
		chain: monadTestnet,
		transport: http(rpcUrl),
	});

	const receipt = await publicClient.waitForTransactionReceipt({ hash });
	if (receipt.status !== "success") return null;

	// Decode PoolCreated event to get poolId
	const { decodeEventLog } = await import("viem");
	const poolCreatedAbi = [
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

	for (const log of receipt.logs) {
		try {
			const decoded = decodeEventLog({
				abi: poolCreatedAbi,
				data: log.data,
				topics: log.topics,
			});
			if (decoded.eventName === "PoolCreated") {
				const { poolId } = decoded.args as { poolId: bigint };
				return { poolId: poolId.toString(), txHash: hash };
			}
		} catch {
			// skip
		}
	}

	return null;
}
