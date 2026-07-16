import { http, createConfig } from "wagmi";
import { monadTestnet } from "wagmi/chains";
import { injected } from "wagmi/connectors";

export const CLASP_ADDRESS = "0xac644Cc4967d9e3735c2dA3D8c8C881637B3A43f" as const;

export const BOARD_ADDRESS = "0x432a33034C9ccabD73c17C08B9237a2aC6C81Ae9" as const;

export const PROFILE_ADDRESS = "0x3A853A7Ed366C545c2f37928CA6e08dcBE694e69" as const;

export const EXPLORER_URL = "https://testnet.monadvision.com";

export const wagmiConfig = createConfig({
  chains: [monadTestnet],
  connectors: [injected()],
  transports: {
    [monadTestnet.id]: http("https://testnet-rpc.monad.xyz"),
  },
});
