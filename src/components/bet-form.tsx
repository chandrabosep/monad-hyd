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
					else router.push("/");
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

	const isWorking = isPending || isConfirming;

	return (
		<form onSubmit={handleSubmit} className="space-y-5">
			<div>
				<label className="block text-sm font-medium text-zinc-300 mb-1.5">
					Question
				</label>
				<textarea
					value={question}
					onChange={(e) => setQuestion(e.target.value)}
					placeholder="Will X happen by [date]?"
					rows={3}
					className="w-full resize-none rounded-xl border border-white/8 bg-white/4 px-4 py-3 text-white placeholder-zinc-500 focus:border-violet-500/50 focus:outline-none focus:bg-white/6 transition-all text-sm"
					required
				/>
			</div>

			<div>
				<label className="block text-sm font-medium text-zinc-300 mb-1.5">
					Closes at
				</label>
				<input
					type="datetime-local"
					value={closeTime}
					onChange={(e) => setCloseTime(e.target.value)}
					min={new Date(Date.now() + 60000).toISOString().slice(0, 16)}
					className="w-full rounded-xl border border-white/8 bg-white/4 px-4 py-3 text-white focus:border-violet-500/50 focus:outline-none focus:bg-white/6 transition-all text-sm scheme-dark"
					required
				/>
			</div>

			<button
				type="submit"
				disabled={isWorking || !question.trim() || !closeTime}
				className="w-full rounded-xl bg-violet-600 px-4 py-3 font-semibold text-white transition-all hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed"
			>
				{isWorking ? (
					<span className="flex items-center justify-center gap-2">
						<svg
							className="h-4 w-4 animate-spin"
							fill="none"
							viewBox="0 0 24 24"
						>
							<circle
								className="opacity-25"
								cx="12"
								cy="12"
								r="10"
								stroke="currentColor"
								strokeWidth="4"
							/>
							<path
								className="opacity-75"
								fill="currentColor"
								d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
							/>
						</svg>
						{isPending ? "Confirm in wallet…" : "Creating pool…"}
					</span>
				) : (
					"Create Pool"
				)}
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

	const isWorking = isPending || isConfirming;

	return (
		<form onSubmit={handleBet} className="space-y-4">
			{/* Side selector */}
			<div className="grid grid-cols-2 gap-2">
				<button
					type="button"
					onClick={() => setSide(true)}
					className={`rounded-xl px-4 py-3 font-semibold text-sm transition-all ${
						side
							? "bg-violet-600 text-white shadow-lg shadow-violet-900/30"
							: "border border-white/8 bg-white/3 text-zinc-400 hover:text-white hover:bg-white/6"
					}`}
				>
					Yes
				</button>
				<button
					type="button"
					onClick={() => setSide(false)}
					className={`rounded-xl px-4 py-3 font-semibold text-sm transition-all ${
						!side
							? "bg-rose-600 text-white shadow-lg shadow-rose-900/30"
							: "border border-white/8 bg-white/3 text-zinc-400 hover:text-white hover:bg-white/6"
					}`}
				>
					No
				</button>
			</div>

			{/* Amount input */}
			<div>
				<label className="block text-sm font-medium text-zinc-300 mb-1.5">
					Amount (MON)
				</label>
				<div className="relative">
					<input
						type="text"
						value={amount}
						onChange={(e) => setAmount(e.target.value)}
						placeholder="0.01"
						className="w-full rounded-xl border border-white/8 bg-white/4 px-4 py-3 text-white placeholder-zinc-500 focus:border-violet-500/50 focus:outline-none focus:bg-white/6 transition-all text-sm pr-16"
					/>
					<span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-medium text-zinc-500">
						MON
					</span>
				</div>
			</div>

			<button
				type="submit"
				disabled={disabled || isWorking || !amount}
				className={`w-full rounded-xl px-4 py-3 font-semibold text-sm text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
					side
						? "bg-violet-600 hover:bg-violet-500"
						: "bg-rose-600 hover:bg-rose-500"
				}`}
			>
				{isWorking ? (
					<span className="flex items-center justify-center gap-2">
						<svg
							className="h-4 w-4 animate-spin"
							fill="none"
							viewBox="0 0 24 24"
						>
							<circle
								className="opacity-25"
								cx="12"
								cy="12"
								r="10"
								stroke="currentColor"
								strokeWidth="4"
							/>
							<path
								className="opacity-75"
								fill="currentColor"
								d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
							/>
						</svg>
						{isPending ? "Confirm in wallet…" : "Placing bet…"}
					</span>
				) : disabled ? (
					"Connect wallet to bet"
				) : (
					`Bet ${side ? "Yes" : "No"}`
				)}
			</button>
		</form>
	);
}
