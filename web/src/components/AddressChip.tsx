import { useState } from "react";
import { useReadContract } from "wagmi";
import { claspProfileAbi } from "../lib/abi-profile";
import { PROFILE_ADDRESS } from "../lib/config";
import {
  identiconColors,
  loadNickname,
  saveNickname,
  shortAddress,
} from "../lib/agreements";

/** Self-declared onchain display name for a wallet. react-query dedupes by
 *  key, so many chips for the same address cost one call. */
export function useDisplayName(address: string) {
  const { data } = useReadContract({
    address: PROFILE_ADDRESS,
    abi: claspProfileAbi,
    functionName: "getProfile",
    args: [address as `0x${string}`],
  });
  const profile = data as { name: string; link: string } | undefined;
  return profile?.name?.trim() ? profile.name.trim() : null;
}

/** A wallet rendered for humans. Precedence: your own local petname beats
 *  their self-declared onchain name (your label can't lie to you), and the
 *  address is ALWAYS visible — names annotate identity, never replace it. */
export function AddressChip({
  address,
  you = false,
}: {
  address: string;
  you?: boolean;
}) {
  const [nickname, setNickname] = useState(() => loadNickname(address));
  const declaredName = useDisplayName(address);
  const [c1, c2] = identiconColors(address);

  const name = nickname ?? declaredName;

  function rename() {
    const next = window.prompt(
      "Your private label for this wallet (only you see it — overrides their public name):",
      nickname ?? "",
    );
    if (next === null) return;
    saveNickname(address, next);
    setNickname(next.trim() || null);
  }

  return (
    <span className="addr-chip" title={address}>
      <span
        className="addr-dot"
        style={{ background: `linear-gradient(135deg, ${c1}, ${c2})` }}
      />
      {name && (
        <span
          className="addr-name"
          title={
            nickname
              ? "Your private label"
              : "Self-declared onchain name — the address and score are the identity"
          }
        >
          {name}
        </span>
      )}
      <code className={name ? "addr-suffix" : undefined}>
        {shortAddress(address)}
      </code>
      {you && <em className="addr-you"> — you</em>}
      <button
        className="addr-rename"
        title={nickname ? `Edit private label (${shortAddress(address)})` : "Add a private label"}
        onClick={rename}
      >
        ✎
      </button>
    </span>
  );
}
