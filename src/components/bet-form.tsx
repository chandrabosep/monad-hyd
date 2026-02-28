"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { parseEther } from "viem";
import { CONTRACT_ADDRESS, MONHARD_ABI } from "@/lib/contract";
import { useInvalidatePools } from "@/lib/queries";

type BetFormProps = {
	poolId: string;
	disabled?: boolean;
};

export function CreatePoolForm() {
	const [question, setQuestion] = useState("");
	const [closeTime, setCloseTime] = useState("");
	const router = useRouter();
	const invalidate = useInvalidatePools();

	const { writeContract, data: hash, isPending } = useWriteContract();
	const { isLoading: isConfirming, status } = useWaitForTransactionReceipt({
		hash,
	});

	useEffect(() => {
		if (status === "success" && hash) {
			fetch("/api/pools/sync", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ txHash: hash }),
			})
				.then((res) => res.json())
				.then((data) => {
					invalidate();
					if (data.poolId) router.push(`/bet/${data.poolId}`);
				});
		}
	}, [status, hash, invalidate, router]);

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		if (!question.trim() || !closeTime) return;
		const closeTs = Math.floor(new Date(closeTime).getTime() / 1000);
		writeContract({
			address: CONTRACT_ADDRESS,
			abi: MONHARD_ABI,
			functionName: "createPool",
			args: [question.trim(), BigInt(closeTs)],
		});
	};

	return (
		<form onSubmit={handleSubmit} className="space-y-4">
			<div>
				<label className="block text-sm font-medium text-zinc-400">
					Question
				</label>
				<input
					type="text"
					value={question}
					onChange={(e) => setQuestion(e.target.value)}
					placeholder="Will X happen?"
					className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-zinc-100 placeholder-zinc-500 focus:border-zinc-600 focus:outline-none"
					required
				/>
			</div>
			<div>
				<label className="block text-sm font-medium text-zinc-400">
					Close time
				</label>
				<input
					type="datetime-local"
					value={closeTime}
					onChange={(e) => setCloseTime(e.target.value)}
					min={new Date().toISOString().slice(0, 16)}
					className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-zinc-100 focus:border-zinc-600 focus:outline-none"
					required
				/>
			</div>
			<button
				type="submit"
				disabled={isPending || isConfirming}
				className="w-full rounded-lg bg-zinc-100 px-4 py-2 font-medium text-zinc-900 transition-colors hover:bg-white disabled:opacity-50"
			>
				{isPending || isConfirming ? "Creating..." : "Create Pool"}
			</button>
		</form>
	);
}

export function BetForm({ poolId, disabled }: BetFormProps) {
	const [amount, setAmount] = useState("");
	const [side, setSide] = useState<boolean>(true);
	const invalidate = useInvalidatePools();

	const { writeContract, data: hash, isPending } = useWriteContract();
	const { isLoading: isConfirming, status } = useWaitForTransactionReceipt({
		hash,
	});

	useEffect(() => {
		if (status === "success") invalidate();
	}, [status, invalidate]);

	const handleBet = (e: React.FormEvent) => {
		e.preventDefault();
		const value = parseEther(amount || "0");
		if (value <= BigInt(0)) return;
		writeContract({
			address: CONTRACT_ADDRESS,
			abi: MONHARD_ABI,
			functionName: "bet",
			args: [BigInt(poolId), side],
			value,
		});
	};

	return (
		<form onSubmit={handleBet} className="space-y-4">
			<div>
				<label className="block text-sm font-medium text-zinc-400">
					Amount (ETH)
				</label>
				<input
					type="text"
					value={amount}
					onChange={(e) => setAmount(e.target.value)}
					placeholder="0.01"
					className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-zinc-100 placeholder-zinc-500 focus:border-zinc-600 focus:outline-none"
				/>
			</div>
			<div className="flex gap-2">
				<button
					type="button"
					onClick={() => setSide(true)}
					className={`flex-1 rounded-lg px-4 py-2 font-medium transition-colors ${
						side
							? "bg-emerald-600 text-white"
							: "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
					}`}
				>
					Yes
				</button>
				<button
					type="button"
					onClick={() => setSide(false)}
					className={`flex-1 rounded-lg px-4 py-2 font-medium transition-colors ${
						!side
							? "bg-rose-600 text-white"
							: "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
					}`}
				>
					No
				</button>
			</div>
			<button
				type="submit"
				disabled={disabled || isPending || isConfirming}
				className="w-full rounded-lg bg-zinc-100 px-4 py-2 font-medium text-zinc-900 transition-colors hover:bg-white disabled:opacity-50"
			>
				{isPending || isConfirming ? "Placing bet..." : "Place Bet"}
			</button>
		</form>
	);
}
