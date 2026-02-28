import { WagmiAdapter } from "@reown/appkit-adapter-wagmi";
import { createStorage, cookieStorage } from "wagmi";
import { monadTestnet } from "@reown/appkit/networks";

export const projectId =
	process.env.NEXT_PUBLIC_PROJECT_ID || "00000000000000000000000000000000";

export const wagmiAdapter = new WagmiAdapter({
	storage: createStorage({ storage: cookieStorage }),
	ssr: true,
	networks: [monadTestnet],
	projectId,
});
