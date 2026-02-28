import Link from "next/link";
import { formatEther } from "viem";
import type { PoolData } from "@/lib/queries";

function getStatus(closeTime: Date, resolved: boolean) {
	if (resolved) return "Resolved";
	if (new Date() > closeTime) return "Closed";
	return "Open";
}

function formatTimeAgo(date: Date) {
	const now = new Date();
	const diff = now.getTime() - date.getTime();
	if (diff < 0) {
		// future — show time remaining
		const pos = -diff;
		const d = Math.floor(pos / 86400000);
		const h = Math.floor((pos % 86400000) / 3600000);
		const m = Math.floor((pos % 3600000) / 60000);
		if (d > 0) return `${d}d ${h}h left`;
		if (h > 0) return `${h}h ${m}m left`;
		return `${m}m left`;
	}
	const s = Math.floor(diff / 1000);
	if (s < 60) return "just now";
	const m = Math.floor(s / 60);
	if (m < 60) return `${m}m ago`;
	const h = Math.floor(m / 60);
	if (h < 24) return `${h}h ago`;
	const d = Math.floor(h / 24);
	if (d < 30) return `${d}d ago`;
	const mo = Math.floor(d / 30);
	return `${mo}mo ago`;
}

function shortAddress(addr: string) {
	if (!addr || addr.length < 10) return addr;
	return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function formatAmount(wei: bigint) {
	const eth = parseFloat(formatEther(wei));
	if (eth === 0) return "0";
	if (eth < 0.001) return eth.toFixed(7);
	if (eth < 1) return eth.toFixed(4);
	return eth.toFixed(2);
}

const STATUS_STYLES: Record<string, string> = {
	Open: "bg-emerald-500/15 text-emerald-400 border border-emerald-500/20",
	Closed: "bg-amber-500/15 text-amber-400 border border-amber-500/20",
	Resolved: "bg-zinc-500/15 text-zinc-400 border border-zinc-500/20",
};

export default function BetCard({ pool }: { pool: PoolData }) {
	const status = getStatus(pool.closeTime, pool.resolved);

	const yes =
		typeof pool.totalYes === "bigint"
			? pool.totalYes
			: BigInt(pool.totalYes ?? 0);
	const no =
		typeof pool.totalNo === "bigint"
			? pool.totalNo
			: BigInt(pool.totalNo ?? 0);
	const total = yes + no;

	const yesPct = total === BigInt(0) ? 50 : Number((yes * BigInt(100)) / total);
	const noPct = 100 - yesPct;

	const displayTime = formatTimeAgo(pool.closeTime);

	return (
		<Link href={`/bet/${pool.id}`} className="">
			<article className="group rounded-2xl border border-white/6 bg-white/3 p-5 transition-all hover:border-violet-500/25 hover:bg-white/5 cursor-pointer">
				{/* Top row: creator + time + status */}
				<div className="flex items-center justify-between mb-3">
					<div className="flex items-center gap-2.5">
						<div className="h-8 w-8 rounded-full bg-linear-to-br from-violet-500 to-fuchsia-600 flex items-center justify-center text-xs font-bold shrink-0">
							{pool.creator ? pool.creator.slice(2, 3).toUpperCase() : "M"}
						</div>
						<span className="text-sm font-medium text-zinc-300">
							@{pool.creator ? shortAddress(pool.creator) : "unknown"}
						</span>
					</div>
					<div className="flex items-center gap-2">
						<span className="text-xs text-zinc-500">{displayTime}</span>
						<span
							className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${STATUS_STYLES[status]}`}
						>
							{status}
						</span>
					</div>
				</div>

				{/* Question */}
				<p className="text-[15px] font-medium text-white leading-snug line-clamp-2 mb-4">
					{pool.question}
				</p>

			{/* Progress bar */}
			<div className="h-2 w-full rounded-full overflow-hidden mb-3 flex bg-white/5">
				{total > BigInt(0) && (
					<>
						<div
							className="h-full transition-all"
							style={{ width: `${yesPct}%`, backgroundColor: "#22c55e" }}
						/>
						<div
							className="h-full transition-all flex-1"
							style={{ backgroundColor: "#ef4444" }}
						/>
					</>
				)}
			</div>

				{/* Yes / No stats */}
				<div className="flex flex-col gap-1.5">
					{/* Yes row */}
					<div className="flex items-center justify-between">
						<div className="flex items-center gap-2">
							<span className="text-sm font-semibold text-emerald-400">
								{yesPct}% Yes
							</span>
						</div>
						<div className="flex items-center gap-1.5 text-xs text-zinc-500">
							<span className="font-mono text-zinc-300">
								{formatAmount(yes)} MON
							</span>
						</div>
					</div>

					{/* No row */}
					<div className="flex items-center justify-between">
						<div className="flex items-center gap-2">
							<span className="text-sm font-semibold" style={{ color: "#ef4444" }}>
								{noPct}% No
							</span>
						</div>
						<div className="flex items-center gap-1.5 text-xs text-zinc-500">
							<span className="font-mono text-zinc-300">
								{formatAmount(no)} MON
							</span>
						</div>
					</div>
				</div>

				{pool.resolved && pool.winningSide !== null && (
					<div className="mt-3 pt-3 border-t border-white/5">
					<span
						className={`text-xs font-semibold ${pool.winningSide ? "text-emerald-400" : ""}`}
						style={!pool.winningSide ? { color: "#ef4444" } : {}}
					>
							Winner: {pool.winningSide ? "Yes" : "No"}
						</span>
					</div>
				)}
			</article>
		</Link>
	);
}
