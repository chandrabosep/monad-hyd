export const CONTRACT_ADDRESS = (process.env.NEXT_PUBLIC_CONTRACT_ADDRESS ||
	process.env.NEXT_PUBLIC_MONHARD_CONTRACT_ADDRESS ||
	"0x0000000000000000000000000000000000000000") as `0x${string}`;

export const MONHARD_ABI = [
	{
		inputs: [
			{ name: "question", type: "string" },
			{ name: "closeTime", type: "uint256" },
		],
		name: "createPool",
		outputs: [{ name: "poolId", type: "uint256" }],
		stateMutability: "nonpayable",
		type: "function",
	},
	{
		inputs: [
			{ name: "poolId", type: "uint256" },
			{ name: "side", type: "bool" },
		],
		name: "bet",
		outputs: [],
		stateMutability: "payable",
		type: "function",
	},
	{
		inputs: [
			{ name: "poolId", type: "uint256" },
			{ name: "winningSide", type: "bool" },
		],
		name: "resolve",
		outputs: [],
		stateMutability: "nonpayable",
		type: "function",
	},
	{
		inputs: [{ name: "poolId", type: "uint256" }],
		name: "claim",
		outputs: [],
		stateMutability: "nonpayable",
		type: "function",
	},
	{
		inputs: [{ name: "", type: "uint256" }],
		name: "pools",
		outputs: [
			{ name: "id", type: "uint256" },
			{ name: "question", type: "string" },
			{ name: "closeTime", type: "uint256" },
			{ name: "totalYes", type: "uint256" },
			{ name: "totalNo", type: "uint256" },
			{ name: "resolved", type: "bool" },
			{ name: "winningSide", type: "bool" },
			{ name: "creator", type: "address" },
		],
		stateMutability: "view",
		type: "function",
	},
	{
		inputs: [
			{ name: "", type: "uint256" },
			{ name: "", type: "address" },
		],
		name: "bets",
		outputs: [
			{ name: "amount", type: "uint256" },
			{ name: "side", type: "bool" },
			{ name: "claimed", type: "bool" },
		],
		stateMutability: "view",
		type: "function",
	},
	{
		inputs: [],
		name: "nextPoolId",
		outputs: [{ name: "", type: "uint256" }],
		stateMutability: "view",
		type: "function",
	},
	{
		anonymous: false,
		inputs: [
			{ indexed: true, name: "poolId", type: "uint256" },
			{ indexed: false, name: "question", type: "string" },
			{ indexed: false, name: "closeTime", type: "uint256" },
		],
		name: "PoolCreated",
		type: "event",
	},
] as const;

export type MonHardAbi = typeof MONHARD_ABI;
