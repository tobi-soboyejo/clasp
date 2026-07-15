import { http, createConfig } from "wagmi";
import { monadTestnet } from "wagmi/chains";
import { injected } from "wagmi/connectors";

export const HANDSHAKE_ADDRESS = "0xbefa778FDb69FCD1F851801a5D5e8b8191C7929c" as const;

export const BOARD_ADDRESS = "0x22B2318559aa8d9e55210A778a516bA9A9060067" as const;

export const EXPLORER_URL = "https://testnet.monadvision.com";

export const wagmiConfig = createConfig({
  chains: [monadTestnet],
  connectors: [injected()],
  transports: {
    [monadTestnet.id]: http("https://testnet-rpc.monad.xyz"),
  },
});
