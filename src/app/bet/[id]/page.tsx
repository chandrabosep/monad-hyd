"use client";

import { useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
	useAccount,
	useReadContract,
	useWriteContract,
	useWaitForTransactionReceipt,
} from "wagmi";
import { formatEther } from "viem";
import ConnectButton from "@/components/connect-button";
import { BetForm } from "@/components/bet-form";
import { useBet, useInvalidatePools } from "@/lib/queries";
import { CONTRACT_ADDRESS, MONHARD_ABI } from "@/lib/contract";

function formatTimeLeft(closeTime: Date) {
	const now = new Date();
	const diff = closeTime.getTime() - now.getTime();
	if (diff <= 0) return "Ended";
	const d = Math.floor(diff / 86400000);
	const h = Math.floor((diff % 86400000) / 3600000);
	const m = Math.floor((diff % 3600000) / 60000);
	if (d > 0) return `${d}d ${h}h left`;
	if (h > 0) return `${h}h ${m}m left`;
	return `${m}m left`;
}

function getStatus(closeTime: Date, resolved: boolean) {
	if (resolved) return "Resolved";
	if (new Date() > closeTime) return "Closed";
	return "Open";
}

const STATUS_STYLES: Record<string, string> = {
	Open: "bg-emerald-500/15 text-emerald-400 border border-emerald-500/20",
	Closed: "bg-amber-500/15 text-amber-400 border border-amber-500/20",
	Resolved: "bg-zinc-500/15 text-zinc-400 border border-zinc-500/20",
};

function formatAmount(wei: bigint) {
	const eth = parseFloat(formatEther(wei));
	if (eth === 0) return "0";
	if (eth < 0.001) return eth.toFixed(6);
	if (eth < 1) return eth.toFixed(4);
	return eth.toFixed(2);
}

export default function BetDetailPage() {
	const params = useParams();
	const id = params.id as string;
	const { address } = useAccount();
	const { data: pool, isLoading } = useBet(id);
	const invalidate = useInvalidatePools();

	const { data: userBet } = useReadContract({
		address: CONTRACT_ADDRESS,
		abi: MONHARD_ABI,
		functionName: "bets",
		args: address ? [BigInt(id), address] : undefined,
	});

	const { writeContract: writeResolve, data: resolveHash } = useWriteContract();
	const { writeContract: writeClaim, data: claimHash } = useWriteContract();

	const { status: resolveStatus } = useWaitForTransactionReceipt({
		hash: resolveHash,
	});
	const { status: claimStatus } = useWaitForTransactionReceipt({
		hash: claimHash,
	});

	useEffect(() => {
		if (resolveStatus === "success" || claimStatus === "success") invalidate();
	}, [resolveStatus, claimStatus, invalidate]);

	const canResolve =
		address &&
		pool &&
		pool.resolved === false &&
		new Date() > pool.closeTime &&
		pool.creator?.toLowerCase() === address.toLowerCase();

	const canBet = pool && !pool.resolved && new Date() < pool.closeTime;

	const userWon =
		pool?.resolved &&
		userBet &&
		Number(userBet[0]) > 0 &&
		userBet[1] === pool.winningSide &&
		!userBet[2];

	const totalYes = pool
		? typeof pool.totalYes === "bigint"
			? pool.totalYes
			: BigInt(pool.totalYes ?? 0)
		: BigInt(0);
	const totalNo = pool
		? typeof pool.totalNo === "bigint"
			? pool.totalNo
			: BigInt(pool.totalNo ?? 0)
		: BigInt(0);

	const total = totalYes + totalNo;
	const yesPct =
		total === BigInt(0) ? 50 : Number((totalYes * BigInt(100)) / total);
	const noPct = 100 - yesPct;

	if (isLoading || !pool) {
		return (
			<div className="min-h-screen bg-[#0b0b12] flex items-center justify-center">
				<div className="flex flex-col items-center gap-3">
					<div className="h-8 w-8 rounded-full border-2 border-violet-500 border-t-transparent animate-spin" />
					<p className="text-sm text-zinc-500">Loading pool…</p>
				</div>
			</div>
		);
	}

	const status = getStatus(pool.closeTime, pool.resolved);

	return (
		<div className="min-h-screen bg-[#0b0b12] text-white">
			<header className="sticky top-0 z-20 border-b border-white/6 bg-[#0b0b12]/80 backdrop-blur-md px-4 py-3">
				<div className="mx-auto flex max-w-7xl items-center justify-between">
					<Link
						href="/"
						className="text-lg font-bold tracking-tight bg-linear-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent"
					>
						MonHard
					</Link>
					<ConnectButton />
				</div>
			</header>

			<main className="mx-auto max-w-2xl px-4 py-10">
				<Link
					href="/"
					className="mb-6 inline-flex items-center gap-1.5 text-sm text-zinc-400 hover:text-white transition-colors"
				>
					<svg
						className="h-4 w-4"
						fill="none"
						stroke="currentColor"
						viewBox="0 0 24 24"
					>
						<path
							strokeLinecap="round"
							strokeLinejoin="round"
							strokeWidth={2}
							d="M15 19l-7-7 7-7"
						/>
					</svg>
					Back to pools
				</Link>

				{/* Pool card */}
				<div className="rounded-2xl border border-white/6 bg-white/3 p-6 mb-4">
					{/* Status + time */}
					<div className="flex items-center justify-between mb-4">
						<span
							className={`rounded-full px-2.5 py-1 text-xs font-semibold uppercase tracking-wide ${STATUS_STYLES[status]}`}
						>
							{status}
						</span>
						<span className="text-sm text-zinc-500">
							{formatTimeLeft(pool.closeTime)}
						</span>
					</div>

					{/* Question */}
					<h1 className="text-xl font-bold text-white leading-snug mb-6">
						{pool.question}
					</h1>

					{/* Progress bar */}
					<div className="h-2.5 w-full rounded-full overflow-hidden bg-white/5 mb-4">
						<div
							className="h-full rounded-full bg-linear-to-r from-violet-500 to-fuchsia-500 transition-all"
							style={{ width: `${yesPct}%` }}
						/>
					</div>

					{/* Yes / No stats */}
					<div className="grid grid-cols-2 gap-4">
						<div className="rounded-xl border border-violet-500/20 bg-violet-500/5 p-4">
							<p className="text-2xl font-bold text-violet-400">{yesPct}%</p>
							<p className="text-xs font-medium text-zinc-400 mt-1">Yes</p>
							<p className="text-sm font-mono text-zinc-300 mt-2">
								{formatAmount(totalYes)} MON
							</p>
						</div>
						<div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-4">
							<p className="text-2xl font-bold text-rose-400">{noPct}%</p>
							<p className="text-xs font-medium text-zinc-400 mt-1">No</p>
							<p className="text-sm font-mono text-zinc-300 mt-2">
								{formatAmount(totalNo)} MON
							</p>
						</div>
					</div>

					{pool.resolved && pool.winningSide !== null && (
						<div className="mt-5 rounded-xl border border-white/6 bg-white/3 p-4 flex items-center gap-3">
							<div
								className={`h-8 w-8 rounded-full flex items-center justify-center text-lg ${pool.winningSide ? "bg-violet-500/20 text-violet-400" : "bg-rose-500/20 text-rose-400"}`}
							>
								{pool.winningSide ? "✓" : "✗"}
							</div>
							<div>
								<p className="text-xs text-zinc-500 font-medium uppercase tracking-wide">
									Resolved
								</p>
								<p
									className={`text-sm font-semibold ${pool.winningSide ? "text-violet-400" : "text-rose-400"}`}
								>
									{pool.winningSide ? "Yes" : "No"} won
								</p>
							</div>
						</div>
					)}
				</div>

				{/* Actions */}
				{(canBet || canResolve || userWon) && (
					<div className="rounded-2xl border border-white/6 bg-white/3 p-6 space-y-6">
						{canBet && (
							<section>
								<h2 className="text-sm font-semibold text-zinc-300 mb-4">
									Place your bet
								</h2>
								<BetForm poolId={id} disabled={!address} />
							</section>
						)}

						{canResolve && (
							<section>
								<h2 className="text-sm font-semibold text-zinc-300 mb-4">
									Resolve pool{" "}
									<span className="text-xs text-zinc-500 font-normal">
										(creator only)
									</span>
								</h2>
								<div className="grid grid-cols-2 gap-3">
									<button
										onClick={() =>
											writeResolve({
												address: CONTRACT_ADDRESS,
												abi: MONHARD_ABI,
												functionName: "resolve",
												args: [BigInt(id), true],
											})
										}
										className="rounded-xl bg-violet-600 px-4 py-3 font-semibold text-white text-sm hover:bg-violet-500 transition-colors"
									>
										Resolve Yes
									</button>
									<button
										onClick={() =>
											writeResolve({
												address: CONTRACT_ADDRESS,
												abi: MONHARD_ABI,
												functionName: "resolve",
												args: [BigInt(id), false],
											})
										}
										className="rounded-xl bg-rose-600 px-4 py-3 font-semibold text-white text-sm hover:bg-rose-500 transition-colors"
									>
										Resolve No
									</button>
								</div>
							</section>
						)}

						{userWon && (
							<section>
								<div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 mb-4">
									<p className="text-sm font-semibold text-emerald-400">
										You won! Claim your winnings below.
									</p>
								</div>
								<button
									onClick={() =>
										writeClaim({
											address: CONTRACT_ADDRESS,
											abi: MONHARD_ABI,
											functionName: "claim",
											args: [BigInt(id)],
										})
									}
									className="w-full rounded-xl bg-emerald-600 px-4 py-3 font-semibold text-white text-sm hover:bg-emerald-500 transition-colors"
								>
									Claim Winnings
								</button>
							</section>
						)}
					</div>
				)}
			</main>
		</div>
	);
}
