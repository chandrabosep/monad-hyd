"use client";

import Link from "next/link";
import ConnectButton from "@/components/connect-button";
import { CreatePoolForm } from "@/components/bet-form";

export default function CreateBetPage() {
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

			<main className="mx-auto max-w-lg px-4 py-12">
				<Link
					href="/"
					className="mb-8 inline-flex items-center gap-1.5 text-sm text-zinc-400 hover:text-white transition-colors"
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

				<div className="rounded-2xl border border-white/6 bg-white/3 p-8">
					<div className="mb-8">
						<h1 className="text-2xl font-bold text-white">
							Create Prediction Pool
						</h1>
						<p className="mt-1.5 text-sm text-zinc-400">
							Ask a question. Let the crowd decide.
						</p>
					</div>

					<CreatePoolForm />
				</div>

				<p className="mt-4 text-center text-xs text-zinc-600">
					Pool creation requires a wallet transaction on Monad testnet.
				</p>
			</main>
		</div>
	);
}
