import { NextResponse } from "next/server";
import { createPublicClient, http, decodeFunctionData } from "viem";
import { CONTRACT_ADDRESS, MONHARD_ABI } from "@/lib/contract";
import { monadTestnetConfig } from "@/lib/monad-config";
import { prisma } from "@/lib/prisma";

const publicClient = createPublicClient({
	chain: monadTestnetConfig,
	transport: http(
		process.env.NEXT_PUBLIC_MONAD_RPC_URL ||
			"https://testnet-rpc.monad.xyz",
	),
});

export async function POST(request: Request) {
	try {
		const body = await request.json();
		const { txHash, poolId, userAddress, amount, side } = body as {
			txHash: string;
			poolId: string;
			userAddress: string;
			amount: string;
			side: boolean;
		};

		const receipt = await publicClient.getTransactionReceipt({
			hash: txHash as `0x${string}`,
		});
		const tx = await publicClient.getTransaction({
			hash: txHash as `0x${string}`,
		});

		if (!receipt || receipt.status !== "success" || !tx) {
			return NextResponse.json(
				{ error: "Transaction not mined or failed." },
				{ status: 400 },
			);
		}

		if ((tx.to || "").toLowerCase() !== CONTRACT_ADDRESS.toLowerCase()) {
			return NextResponse.json(
				{ error: "Transaction is not sent to MonHard contract." },
				{ status: 400 },
			);
		}

		let decoded: ReturnType<typeof decodeFunctionData<typeof MONHARD_ABI>>;
		try {
			decoded = decodeFunctionData({
				abi: MONHARD_ABI,
				data: tx.input,
			});
		} catch {
			return NextResponse.json(
				{ error: "Transaction is not a valid contract call." },
				{ status: 400 },
			);
		}

		if (decoded.functionName !== "bet" || !decoded.args) {
			return NextResponse.json(
				{ error: "Transaction is not a bet() call." },
				{ status: 400 },
			);
		}

		const args = decoded.args as readonly [bigint, boolean];
		const [chainPoolIdBigInt, chainSide] = args;
		const chainPoolId = chainPoolIdBigInt.toString();
		const chainUser = receipt.from.toLowerCase();
		const chainAmount = (tx.value ?? 0n).toString();

		if (
			chainPoolId !== poolId ||
			chainUser !== userAddress.toLowerCase() ||
			chainSide !== side ||
			chainAmount !== amount
		) {
			return NextResponse.json(
				{ error: "Request data does not match on-chain transaction." },
				{ status: 400 },
			);
		}

		await prisma.bet.create({
			data: {
				poolId,
				userAddress,
				amount,
				side,
			},
		});

		return NextResponse.json({ ok: true });
	} catch (error) {
		return NextResponse.json(
			{ error: (error as Error).message || "Unknown error" },
			{ status: 500 },
		);
	}
}
