"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useReadContract } from "wagmi";
import { CONTRACT_ADDRESS, MONHARD_ABI } from "./contract";

export type PoolData = {
	id: string;
	question: string;
	closeTime: Date;
	totalYes: bigint;
	totalNo: bigint;
	resolved: boolean;
	winningSide: boolean | null;
	creator: string;
};

type ApiPool = {
	id: string;
	question: string;
	closeTime: string;
	totalYes?: string;
	totalNo?: string;
	resolved: boolean;
	winningSide: boolean | null;
	creator: string;
};

async function fetchPoolsFromDb(): Promise<PoolData[]> {
	const res = await fetch("/api/pools");
	if (!res.ok) return [];
	const data: ApiPool[] = await res.json();
	return data.map((p) => ({
		...p,
		closeTime: new Date(p.closeTime),
		totalYes: BigInt(p.totalYes ?? 0),
		totalNo: BigInt(p.totalNo ?? 0),
	}));
}

export function useBets() {
	return useQuery({
		queryKey: ["pools"],
		queryFn: fetchPoolsFromDb,
		refetchInterval: 15000,
	});
}

export function useBet(id: string | null) {
	return useQuery({
		queryKey: ["pool", id],
		queryFn: async () => {
			if (!id) return null;
			const res = await fetch(`/api/pools/${id}`);
			if (!res.ok) return null;
			const p: ApiPool = await res.json();
			return {
				...p,
				closeTime: new Date(p.closeTime),
				totalYes: BigInt(p.totalYes ?? 0),
				totalNo: BigInt(p.totalNo ?? 0),
			};
		},
		enabled: !!id,
		refetchInterval: 15000,
	});
}

export function useNextPoolId() {
	return useReadContract({
		address: CONTRACT_ADDRESS,
		abi: MONHARD_ABI,
		functionName: "nextPoolId",
	});
}

export function useInvalidatePools() {
	const qc = useQueryClient();
	return () => qc.invalidateQueries({ queryKey: ["pools"] });
}
