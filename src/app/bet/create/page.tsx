"use client";

import Link from "next/link";
import ConnectButton from "@/components/connect-button";
import { CreatePoolForm } from "@/components/bet-form";

export default function CreateBetPage() {
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

			<main className="mx-auto max-w-md px-4 py-8">
				<Link
					href="/bet"
					className="mb-6 inline-block text-sm text-zinc-400 hover:text-zinc-100"
				>
					← Back to pools
				</Link>
				<h1 className="mb-6 text-2xl font-semibold text-zinc-100">
					Create Prediction Pool
				</h1>
				<CreatePoolForm />
			</main>
		</div>
	);
}
