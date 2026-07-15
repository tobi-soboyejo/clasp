import { keccak256, toBytes } from "viem";

export const Status = {
  Proposed: 0,
  Active: 1,
  Paid: 2,
  Defaulted: 3,
  Disputed: 4,
} as const;

export type StatusValue = (typeof Status)[keyof typeof Status];

export const DISPUTE_WINDOW_SECONDS = 14n * 24n * 60n * 60n;

export interface AgreementData {
  freelancer: `0x${string}`;
  client: `0x${string}`;
  amountCents: bigint;
  deadline: bigint;
  createdAt: bigint;
  cosignedAt: bigint;
  resolvedAt: bigint;
  disputedAt: bigint;
  scopeHash: `0x${string}`;
  disputeHash: `0x${string}`;
  status: StatusValue;
}

export interface TimelineStep {
  label: string;
  timestamp: bigint;
  txKey: TxKey;
}

/** The full lifecycle is reconstructable from struct timestamps — Monad's
 *  public RPC caps eth_getLogs at 100 blocks, so state IS the history. */
export function timeline(a: AgreementData): TimelineStep[] {
  const steps: TimelineStep[] = [
    { label: "Proposed by freelancer", timestamp: a.createdAt, txKey: "created" },
  ];
  if (a.cosignedAt > 0n)
    steps.push({ label: "Co-signed by client", timestamp: a.cosignedAt, txKey: "cosigned" });
  if (a.status === Status.Paid)
    steps.push({ label: "Payment confirmed by client", timestamp: a.resolvedAt, txKey: "resolved" });
  if (a.status === Status.Defaulted || a.status === Status.Disputed)
    steps.push({ label: "Default flagged by freelancer", timestamp: a.resolvedAt, txKey: "resolved" });
  if (a.disputedAt > 0n)
    steps.push({ label: "Default disputed by client", timestamp: a.disputedAt, txKey: "disputed" });
  return steps;
}

export type TxKey = "created" | "cosigned" | "resolved" | "disputed";

/** Tx hashes for actions taken through this browser, so the timeline can
 *  deep-link to the explorer without any log scanning. Actions taken
 *  elsewhere still show (state has the timestamps) — just without a link. */
const txKeyFor = (id: bigint, key: TxKey) => `clasp:tx:${id}:${key}`;

export function saveTxHash(id: bigint, key: TxKey, hash: string) {
  localStorage.setItem(txKeyFor(id, key), hash);
}

export function loadTxHash(id: bigint, key: TxKey): string | null {
  return localStorage.getItem(txKeyFor(id, key));
}

/* Local nicknames ("petnames"): users label the wallets THEY deal with, like
 * phone contacts. Deliberately not a global username registry — global names
 * can be squatted and spoofed; a label you assigned yourself can't lie to
 * you. Visible only in this browser. */

const nameKey = (addr: string) => `clasp:name:${addr.toLowerCase()}`;

export function saveNickname(addr: string, name: string) {
  if (name.trim()) localStorage.setItem(nameKey(addr), name.trim());
  else localStorage.removeItem(nameKey(addr));
}

export function loadNickname(addr: string): string | null {
  return localStorage.getItem(nameKey(addr));
}

/** Deterministic two-tone gradient per address, so wallets are visually
 *  distinguishable at a glance without reading hex. */
export function identiconColors(addr: string): [string, string] {
  const h1 = parseInt(addr.slice(2, 8), 16) % 360;
  const h2 = (h1 + 40 + (parseInt(addr.slice(8, 12), 16) % 140)) % 360;
  return [`hsl(${h1} 70% 55%)`, `hsl(${h2} 70% 45%)`];
}

/** Display status adds the offchain-derived "Expired" state for proposals
 *  whose deadline passed without a co-signature. */
export function displayStatus(a: AgreementData, nowSec: bigint) {
  if (a.status === Status.Proposed && nowSec > a.deadline) return "Expired";
  return (
    Object.keys(Status) as (keyof typeof Status)[]
  ).find((k) => Status[k] === a.status)!;
}

export function statusClass(label: string) {
  return `status-${label.toLowerCase()}`;
}

export function hashText(text: string): `0x${string}` {
  return keccak256(toBytes(text));
}

export function formatCad(amountCents: bigint) {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
  }).format(Number(amountCents) / 100);
}

export function formatTimestamp(sec: bigint) {
  if (sec === 0n) return "—";
  return new Date(Number(sec) * 1000).toLocaleString("en-CA", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function shortAddress(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

/* v1 keeps full agreement text off-chain in localStorage (see README
 * limitations). Only the keccak256 hash lives onchain. */

const scopeKey = (id: bigint) => `clasp:scope:${id}`;
const disputeKey = (id: bigint) => `clasp:dispute:${id}`;

export function saveScopeText(id: bigint, text: string) {
  localStorage.setItem(scopeKey(id), text);
}

export function loadScopeText(id: bigint): string | null {
  return localStorage.getItem(scopeKey(id));
}

export function saveDisputeText(id: bigint, text: string) {
  localStorage.setItem(disputeKey(id), text);
}

export function loadDisputeText(id: bigint): string | null {
  return localStorage.getItem(disputeKey(id));
}
