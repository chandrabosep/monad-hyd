import Link from "next/link";
import ConnectButton from "@/components/connect-button";

export default function Home() {
	return (
		<div className="flex min-h-screen flex-col bg-zinc-950">
			<header className="border-b border-zinc-800 px-4 py-3">
				<div className="mx-auto flex max-w-4xl items-center justify-between">
					<span className="text-lg font-semibold text-zinc-100">
						MonHard
					</span>
					<ConnectButton />
				</div>
			</header>

			<main className="mx-auto flex max-w-2xl flex-1 flex-col items-center justify-center px-4 py-16 text-center">
				<h1 className="text-4xl font-bold text-zinc-100">
					Prediction Markets on Monad
				</h1>
				<p className="mt-4 text-lg text-zinc-400">
					Create bet pools and trade on outcomes. On-chain. Simple.
				</p>
				<Link
					href="/bet"
					className="mt-8 rounded-lg bg-zinc-100 px-6 py-3 font-medium text-zinc-900 transition-colors hover:bg-white"
				>
					Browse Pools
				</Link>
			</main>
		</div>
	);
}
