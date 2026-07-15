import { useReadContract } from "wagmi";
import { claspAbi } from "../lib/abi";
import { CLASP_ADDRESS, EXPLORER_URL } from "../lib/config";

/** Live read from the deployed registry — proves the app is talking to the
 *  real contract, not placeholder data. */
export function RegistryStats() {
  const { data: count, isLoading, error } = useReadContract({
    address: CLASP_ADDRESS,
    abi: claspAbi,
    functionName: "agreementCount",
  });

  return (
    <p className="registry-stats">
      {isLoading && "Reading registry…"}
      {error && "Couldn't reach Monad testnet."}
      {count !== undefined && (
        <>
          {count.toString()} agreement{count === 1n ? "" : "s"} recorded onchain ·{" "}
          <a
            href={`${EXPLORER_URL}/address/${CLASP_ADDRESS}`}
            target="_blank"
            rel="noreferrer"
          >
            view contract
          </a>
        </>
      )}
    </p>
  );
}
