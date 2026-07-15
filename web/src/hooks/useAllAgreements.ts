import { useReadContract } from "wagmi";
import { claspAbi } from "../lib/abi";
import { CLASP_ADDRESS } from "../lib/config";
import type { AgreementData } from "../lib/agreements";

/** Every agreement in the registry, in one eth_call — getAgreements clamps
 *  toId to the count. Fine at hackathon scale; pagination is built into the
 *  contract for when it isn't. */
export function useAllAgreements() {
  return useReadContract({
    address: CLASP_ADDRESS,
    abi: claspAbi,
    functionName: "getAgreements",
    args: [0n, 1_000_000n],
    query: { refetchInterval: 15_000 },
  }) as {
    data: readonly AgreementData[] | undefined;
    isLoading: boolean;
    error: Error | null;
  };
}
