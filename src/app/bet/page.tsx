"use client";

import Link from "next/link";
import ConnectButton from "@/components/connect-button";
import BetCard from "@/components/bet-card";
import { useBets } from "@/lib/queries";

export default function BetListPage() {
	const { data: pools, isLoading, error } = useBets();

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
					<div className="flex items-center gap-4">
						<Link
							href="/bet/create"
							className="text-sm text-zinc-400 hover:text-zinc-100"
						>
							Create
						</Link>
						<ConnectButton />
					</div>
				</div>
			</header>

			<main className="mx-auto max-w-4xl px-4 py-8">
				<h1 className="mb-6 text-2xl font-semibold text-zinc-100">
					Prediction Markets
				</h1>

				{isLoading && <p className="text-zinc-500">Loading pools...</p>}
				{error && <p className="text-rose-500">Failed to load pools</p>}
				{pools && pools.length === 0 && (
					<p className="text-zinc-500">No pools yet. Create one!</p>
				)}
				{pools && pools.length > 0 && (
					<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
						{pools.map((pool) => (
							<BetCard key={pool.id} pool={pool} />
						))}
					</div>
				)}
			</main>
		</div>
	);
}
