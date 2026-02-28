export type PoolRecord = {
	id: string;
	question: string;
	closeTime: string;
	resolved: boolean;
	winningSide: boolean | null;
	createdBy: string;
};

export type BetRecord = {
	id: string;
	poolId: string;
	userAddress: string;
	amount: string;
	side: boolean;
};

export type PoolDetail = {
	pool: PoolRecord;
	bets: BetRecord[];
};
