"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import ConnectButton from "@/components/connect-button";
import BetCard from "@/components/bet-card";
import { useBets } from "@/lib/queries";

const SORT_OPTIONS = [
	{ id: "newest", label: "Newest" },
	{ id: "highest_vol", label: "Highest Vol." },
	{ id: "ending_soon", label: "Ending Soon" },
	{ id: "recently_closed", label: "Recently Closed" },
];

export default function Home() {
	const { data: pools, isLoading, error } = useBets();
	const [activeSort, setActiveSort] = useState("newest");
	const [search, setSearch] = useState("");

	const displayed = useMemo(() => {
		const list = [...(pools ?? [])];

		const sorted = list.sort((a, b) => {
			if (activeSort === "highest_vol") {
				const volA =
					(typeof a.totalYes === "bigint"
						? a.totalYes
						: BigInt(a.totalYes ?? 0)) +
					(typeof a.totalNo === "bigint"
						? a.totalNo
						: BigInt(a.totalNo ?? 0));
				const volB =
					(typeof b.totalYes === "bigint"
						? b.totalYes
						: BigInt(b.totalYes ?? 0)) +
					(typeof b.totalNo === "bigint"
						? b.totalNo
						: BigInt(b.totalNo ?? 0));
				return volB > volA ? 1 : -1;
			}
			if (activeSort === "ending_soon") {
				const now = new Date();
				const aOpen = a.closeTime > now;
				const bOpen = b.closeTime > now;
				if (aOpen && !bOpen) return -1;
				if (!aOpen && bOpen) return 1;
				return a.closeTime.getTime() - b.closeTime.getTime();
			}
			if (activeSort === "recently_closed") {
				const now = new Date();
				const aClosed = a.closeTime <= now;
				const bClosed = b.closeTime <= now;
				if (aClosed && !bClosed) return -1;
				if (!aClosed && bClosed) return 1;
				return b.closeTime.getTime() - a.closeTime.getTime();
			}
			// newest — sort descending by closeTime as proxy
			return b.closeTime.getTime() - a.closeTime.getTime();
		});

		if (!search.trim()) return sorted;
		return sorted.filter((p) =>
			p.question.toLowerCase().includes(search.toLowerCase())
		);
	}, [pools, activeSort, search]);

	return (
		<div className="min-h-screen bg-[#0b0b12] text-white">
			{/* Header */}
			<header className="sticky top-0 z-20 border-b border-white/6 bg-[#0b0b12]/80 backdrop-blur-md px-4 py-3">
				<div className="mx-auto flex max-w-7xl items-center justify-between">
					<span className="text-lg font-bold tracking-tight bg-linear-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent">
						MonHard
					</span>
					<div className="flex items-center gap-3">
						<Link
							href="/bet/create"
							className="hidden sm:flex items-center gap-1.5 rounded-lg bg-violet-600/20 border border-violet-500/30 px-3 py-1.5 text-sm font-medium text-violet-300 hover:bg-violet-600/30 hover:border-violet-500/50 transition-all"
						>
							<span className="text-base leading-none">+</span> Create Pool
						</Link>
						<ConnectButton />
					</div>
				</div>
			</header>

			<div className="mx-auto flex max-w-7xl gap-5 px-4 py-6">
				{/* Left Sidebar */}
				<aside className="hidden lg:flex w-44 shrink-0 flex-col gap-3">
					{/* Brand card */}
					<div className="rounded-2xl border border-white/6 bg-white/3 p-4">
						<div className="flex flex-col items-center gap-3">
							<div className="h-14 w-14 rounded-full bg-linear-to-br from-violet-500 to-fuchsia-600 flex items-center justify-center text-2xl font-bold shadow-lg shadow-violet-900/40">
								M
							</div>
							<div className="text-center">
								<p className="text-sm font-semibold text-white">MonHard</p>
								<p className="text-xs text-zinc-500">@MonHard</p>
							</div>
							<Link
								href="/bet/create"
								className="w-full rounded-lg bg-violet-600 py-2 text-center text-xs font-semibold hover:bg-violet-500 transition-colors"
							>
								+ Create Pool
							</Link>
						</div>
					</div>

					{/* Sort / Filter nav */}
					<div className="rounded-2xl border border-white/6 bg-white/3 p-2">
						<nav className="space-y-0.5">
							{SORT_OPTIONS.map((opt) => (
								<button
									key={opt.id}
									onClick={() => setActiveSort(opt.id)}
									className={`w-full rounded-lg px-3 py-2 text-left text-sm transition-colors ${
										activeSort === opt.id
											? "bg-violet-600/20 text-violet-300 font-medium"
											: "text-zinc-400 hover:text-white hover:bg-white/5"
									}`}
								>
									{opt.label}
								</button>
							))}
						</nav>
					</div>
				</aside>

				{/* Main Feed */}
				<main className="flex-1 min-w-0">
					{/* Mobile search */}
					<div className="mb-4 xl:hidden">
						<input
							type="text"
							value={search}
							onChange={(e) => setSearch(e.target.value)}
							placeholder="Search pools..."
							className="w-full rounded-xl border border-white/8 bg-white/4 px-4 py-2.5 text-sm text-white placeholder-zinc-500 focus:border-violet-500/50 focus:outline-none focus:bg-white/6 transition-all"
						/>
					</div>

					{/* Mobile sort pills */}
					<div className="mb-4 flex gap-2 overflow-x-auto pb-1 lg:hidden">
						{SORT_OPTIONS.map((opt) => (
							<button
								key={opt.id}
								onClick={() => setActiveSort(opt.id)}
								className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
									activeSort === opt.id
										? "bg-violet-600 text-white"
										: "bg-white/5 text-zinc-400 hover:text-white"
								}`}
							>
								{opt.label}
							</button>
						))}
					</div>

					{isLoading && (
						<div className="space-y-3">
							{Array.from({ length: 4 }).map((_, i) => (
								<div
									key={i}
									className="h-36 rounded-2xl bg-white/3 animate-pulse"
								/>
							))}
						</div>
					)}

					{error && (
						<div className="rounded-2xl border border-rose-500/20 bg-rose-500/5 p-6 text-center">
							<p className="text-rose-400 text-sm">Failed to load pools.</p>
						</div>
					)}

					{!isLoading && !error && displayed.length === 0 && (
						<div className="rounded-2xl border border-white/6 bg-white/3 p-16 text-center">
							<p className="text-zinc-400 text-sm">
								{search ? "No pools match your search." : "No pools yet."}
							</p>
							<Link
								href="/bet/create"
								className="mt-4 inline-block rounded-xl bg-violet-600 px-6 py-2.5 text-sm font-semibold hover:bg-violet-500 transition-colors"
							>
								Create the first pool
							</Link>
						</div>
					)}

					<div className="space-y-3">
						{displayed.map((pool) => (
							<BetCard key={pool.id} pool={pool} />
						))}
					</div>
				</main>

				{/* Right Sidebar — Search */}
				<aside className="hidden xl:flex w-60 shrink-0 flex-col gap-3">
					<div className="rounded-2xl border border-white/6 bg-white/3 p-3">
						<input
							type="text"
							value={search}
							onChange={(e) => setSearch(e.target.value)}
							placeholder="Search pools..."
							className="w-full rounded-xl border border-white/8 bg-white/4 px-3 py-2.5 text-sm text-white placeholder-zinc-500 focus:border-violet-500/50 focus:outline-none focus:bg-white/7 transition-all"
						/>
					</div>
					<div className="rounded-2xl border border-white/6 bg-white/3 p-3">
						<p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3 px-1">
							Stats
						</p>
						<div className="space-y-2">
							<div className="flex items-center justify-between px-1">
								<span className="text-xs text-zinc-400">Total pools</span>
								<span className="text-xs font-semibold text-white">
									{pools?.length ?? 0}
								</span>
							</div>
							<div className="flex items-center justify-between px-1">
								<span className="text-xs text-zinc-400">Open</span>
								<span className="text-xs font-semibold text-emerald-400">
									{pools?.filter(
										(p) => !p.resolved && new Date() < p.closeTime
									).length ?? 0}
								</span>
							</div>
							<div className="flex items-center justify-between px-1">
								<span className="text-xs text-zinc-400">Resolved</span>
								<span className="text-xs font-semibold text-zinc-400">
									{pools?.filter((p) => p.resolved).length ?? 0}
								</span>
							</div>
						</div>
					</div>
				</aside>
			</div>
		</div>
	);
}
