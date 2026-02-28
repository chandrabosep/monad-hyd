import Link from "next/link";
import { formatEther } from "viem";
import type { PoolData } from "@/lib/queries";

function getStatus(closeTime: Date, resolved: boolean) {
	if (resolved) return "Resolved";
	if (new Date() > closeTime) return "Closed";
	return "Open";
}

function getStatusColor(status: string) {
	if (status === "Open") return "bg-emerald-500/20 text-emerald-400";
	if (status === "Closed") return "bg-amber-500/20 text-amber-400";
	return "bg-zinc-500/20 text-zinc-400";
}

function formatTimeLeft(closeTime: Date) {
	const now = new Date();
	const diff = closeTime.getTime() - now.getTime();
	if (diff <= 0) return "Ended";
	const d = Math.floor(diff / 86400000);
	const h = Math.floor((diff % 86400000) / 3600000);
	const m = Math.floor((diff % 3600000) / 60000);
	if (d > 0) return `${d}d ${h}h`;
	if (h > 0) return `${h}h ${m}m`;
	return `${m}m`;
}

export default function BetCard({ pool }: { pool: PoolData }) {
	const status = getStatus(pool.closeTime, pool.resolved);
	const totalYes =
		typeof pool.totalYes === "bigint"
			? pool.totalYes
			: BigInt(pool.totalYes ?? 0);
	const totalNo =
		typeof pool.totalNo === "bigint"
			? pool.totalNo
			: BigInt(pool.totalNo ?? 0);

	return (
		<Link href={`/bet/${pool.id}`}>
			<article className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4 transition-colors hover:border-zinc-700 hover:bg-zinc-900">
				<h3 className="font-medium text-zinc-100 line-clamp-2">
					{pool.question}
				</h3>
				<div className="mt-3 flex flex-wrap items-center gap-2">
					<span className="text-sm text-emerald-400">
						Yes: {formatEther(totalYes)} ETH
					</span>
					<span className="text-sm text-rose-400">
						No: {formatEther(totalNo)} ETH
					</span>
				</div>
				<div className="mt-2 flex items-center justify-between">
					<span className="text-xs text-zinc-500">
						Closes: {formatTimeLeft(pool.closeTime)}
					</span>
					<span
						className={`rounded px-2 py-0.5 text-xs font-medium ${getStatusColor(status)}`}
					>
						{status}
					</span>
				</div>
			</article>
		</Link>
	);
}
