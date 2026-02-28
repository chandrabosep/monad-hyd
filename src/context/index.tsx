"use client";

import { createAppKit } from "@reown/appkit/react";
import { WagmiProvider } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cookieToInitialState } from "wagmi";
import type { Config } from "wagmi";
import { wagmiAdapter, projectId } from "@/config";
import { monadTestnet } from "@reown/appkit/networks";

const queryClient = new QueryClient();

const metadata = {
	name: "MonHard",
	description: "On-Chain Prediction Markets on Monad",
	url:
		typeof window !== "undefined"
			? window.location.origin
			: "https://monhard.xyz",
	icons: ["https://avatars.githubusercontent.com/u/179229932"],
};

createAppKit({
	adapters: [wagmiAdapter],
	networks: [monadTestnet],
	projectId,
	metadata,
});

export function ContextProvider({
	children,
	cookies,
}: {
	children: React.ReactNode;
	cookies: string | null;
}) {
	const initialState = cookieToInitialState(
		wagmiAdapter.wagmiConfig as Config,
		cookies,
	);

	return (
		<WagmiProvider
			config={wagmiAdapter.wagmiConfig as Config}
			initialState={initialState}
		>
			<QueryClientProvider client={queryClient}>
				{children}
			</QueryClientProvider>
		</WagmiProvider>
	);
}
