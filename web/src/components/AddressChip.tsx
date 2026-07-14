import { useState } from "react";
import {
  identiconColors,
  loadNickname,
  saveNickname,
  shortAddress,
} from "../lib/agreements";

/** A wallet address rendered for humans: identicon dot, local nickname if
 *  one is set, short address otherwise. Click the tag icon to (re)name —
 *  names live only in this browser. */
export function AddressChip({
  address,
  you = false,
}: {
  address: string;
  you?: boolean;
}) {
  const [nickname, setNickname] = useState(() => loadNickname(address));
  const [c1, c2] = identiconColors(address);

  function rename() {
    const next = window.prompt(
      "Name this wallet (visible only to you, like a phone contact):",
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
      {nickname ? (
        <span className="addr-name">{nickname}</span>
      ) : (
        <code>{shortAddress(address)}</code>
      )}
      {you && <em className="addr-you"> — you</em>}
      <button
        className="addr-rename"
        title={nickname ? `Rename (${shortAddress(address)})` : "Name this wallet"}
        onClick={rename}
      >
        ✎
      </button>
    </span>
  );
}
