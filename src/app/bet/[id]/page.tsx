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

	const { writeContract: writeResolve, data: resolveHash } =
		useWriteContract();
	const { writeContract: writeClaim, data: claimHash } = useWriteContract();

	const { status: resolveStatus } = useWaitForTransactionReceipt({
		hash: resolveHash,
	});
	const { status: claimStatus } = useWaitForTransactionReceipt({
		hash: claimHash,
	});

	useEffect(() => {
		if (resolveStatus === "success" || claimStatus === "success")
			invalidate();
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

	if (isLoading || !pool) {
		return (
			<div className="min-h-screen bg-zinc-950 p-8">
				<p className="text-zinc-500">Loading...</p>
			</div>
		);
	}

	const status = getStatus(pool.closeTime, pool.resolved);

	return (
		<div className="min-h-screen bg-zinc-950">
			<header className="border-b border-zinc-800 px-4 py-3">
				<div className="mx-auto flex max-w-4xl items-center justify-between">
					<Link
						href="/"
						className="text-lg font-semibold text-zinc-100"
					>
						MonHard
					</Link>
					<ConnectButton />
				</div>
			</header>

			<main className="mx-auto max-w-2xl px-4 py-8">
				<Link
					href="/bet"
					className="mb-6 inline-block text-sm text-zinc-400 hover:text-zinc-100"
				>
					← Back to pools
				</Link>

				<div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-6">
					<h1 className="text-xl font-semibold text-zinc-100">
						{pool.question}
					</h1>
					<div className="mt-4 flex flex-wrap gap-4">
						<span className="text-emerald-400">
							Yes: {formatEther(totalYes)} ETH
						</span>
						<span className="text-rose-400">
							No: {formatEther(totalNo)} ETH
						</span>
					</div>
					<div className="mt-2 flex items-center gap-2">
						<span className="text-sm text-zinc-500">
							{formatTimeLeft(pool.closeTime)}
						</span>
						<span
							className={`rounded px-2 py-0.5 text-xs font-medium ${
								status === "Open"
									? "bg-emerald-500/20 text-emerald-400"
									: status === "Closed"
										? "bg-amber-500/20 text-amber-400"
										: "bg-zinc-500/20 text-zinc-400"
							}`}
						>
							{status}
						</span>
					</div>

					{pool.resolved && (
						<p className="mt-4 text-sm text-zinc-400">
							Winner: {pool.winningSide ? "Yes" : "No"}
						</p>
					)}

					<div className="mt-6 space-y-6">
						{canBet && (
							<section>
								<h2 className="mb-3 text-sm font-medium text-zinc-400">
									Place Bet
								</h2>
								<BetForm poolId={id} disabled={!address} />
							</section>
						)}

						{canResolve && (
							<section>
								<h2 className="mb-3 text-sm font-medium text-zinc-400">
									Resolve (Creator)
								</h2>
								<div className="flex gap-2">
									<button
										onClick={() =>
											writeResolve({
												address: CONTRACT_ADDRESS,
												abi: MONHARD_ABI,
												functionName: "resolve",
												args: [BigInt(id), true],
											})
										}
										className="flex-1 rounded-lg bg-emerald-600 px-4 py-2 font-medium text-white hover:bg-emerald-500"
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
										className="flex-1 rounded-lg bg-rose-600 px-4 py-2 font-medium text-white hover:bg-rose-500"
									>
										Resolve No
									</button>
								</div>
							</section>
						)}

						{userWon && (
							<section>
								<button
									onClick={() =>
										writeClaim({
											address: CONTRACT_ADDRESS,
											abi: MONHARD_ABI,
											functionName: "claim",
											args: [BigInt(id)],
										})
									}
									className="w-full rounded-lg bg-emerald-600 px-4 py-2 font-medium text-white hover:bg-emerald-500"
								>
									Claim Winnings
								</button>
							</section>
						)}
					</div>
				</div>
			</main>
		</div>
	);
}
