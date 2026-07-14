import {
  type AgreementData,
  DISPUTE_WINDOW_SECONDS,
  Status,
} from "./agreements";

/**
 * The Handshake Score: FICO-style 300–850, computed client-side from public
 * onchain state at render time. Glass-box on principle — every factor below
 * is printed on the reputation card and documented in the README. On a
 * public chain an opaque score would be a pretense anyway: anyone can
 * recompute. The data is the permanent thing; this score is a published,
 * contestable lens over it.
 *
 * Per concluded agreement (as the paying party):
 *   base    paid = 1 · disputed = 0.4 · defaulted = 0
 *   weight  defaulted counts ×2 (a default flag is the strongest signal;
 *           disputing restores partial credit via base 0.4)
 *   size    amount/$500, clamped to [0.25, 3] — big deals matter more,
 *           but no single deal dominates, and $5 gigs can't pad a record
 *   recency ½^(age in years) — behavior fades with a 1-year half-life;
 *           rehabilitation is arithmetic, not a promise
 *
 *   pct = Σ(base·size·recency) / Σ(weight·size·recency)
 *
 * Diversity: ten deals with ten people ≠ ten deals with one.
 *   diversityFactor = 0.6 + 0.4 × (unique counterparties / concluded)
 *
 *   score = 300 + pct × diversityFactor × 550
 *
 * Defaults count from the moment they're flagged — the registry warns the
 * next person NOW; the client's dispute restores credit the moment it lands.
 * Under 3 concluded outcomes the score is provisional.
 */

export type OutcomeKind = "paid" | "disputed" | "default-window-open" | "silent-default";

export interface ScoredOutcome {
  id: bigint;
  kind: OutcomeKind;
  amountCents: bigint;
  at: bigint; // when the outcome landed (resolvedAt)
  counterparty: string;
  base: number;
  weightMult: number;
  sizeFactor: number;
  recencyFactor: number;
}

export interface HandshakeScore {
  score: number | null; // 300–850, null = no concluded history
  band: string; // Excellent / Good / Fair / Poor / Bad / No history
  pct: number | null;
  diversityFactor: number;
  uniqueCounterparties: number;
  concluded: number;
  provisional: boolean;
  outcomes: ScoredOutcome[]; // newest first, for the printed breakdown
  /** consecutive paid outcomes since the most recent default/dispute — the
   *  rehabilitation trend, shown when a bad mark exists */
  recoveryStreak: number | null;
}

export interface Reputation {
  asClient: {
    paid: number;
    disputed: number;
    silentDefaults: number;
    windowOpenDefaults: number;
    active: number;
    volumeCents: bigint;
  };
  asFreelancer: {
    total: number;
    active: number;
    concluded: number;
    volumeCents: bigint;
  };
  firstSeen: bigint | null;
  handshakeScore: HandshakeScore;
}

const YEAR_SECONDS = 365 * 24 * 3600;

export function bandFor(score: number): string {
  if (score >= 750) return "Excellent";
  if (score >= 650) return "Good";
  if (score >= 550) return "Fair";
  if (score >= 450) return "Poor";
  return "Bad";
}

function outcomeKind(a: AgreementData, nowSec: bigint): OutcomeKind | null {
  if (a.status === Status.Paid) return "paid";
  if (a.status === Status.Disputed) return "disputed";
  if (a.status === Status.Defaulted) {
    return nowSec <= a.resolvedAt + DISPUTE_WINDOW_SECONDS
      ? "default-window-open"
      : "silent-default";
  }
  return null;
}

const BASE: Record<OutcomeKind, number> = {
  paid: 1,
  disputed: 0.4,
  "default-window-open": 0,
  "silent-default": 0,
};

const WEIGHT_MULT: Record<OutcomeKind, number> = {
  paid: 1,
  disputed: 1,
  "default-window-open": 2,
  "silent-default": 2,
};

export function computeScore(
  rows: { a: AgreementData; id: bigint }[],
  nowSec: bigint,
): HandshakeScore {
  const outcomes: ScoredOutcome[] = [];

  for (const { a, id } of rows) {
    const kind = outcomeKind(a, nowSec);
    if (!kind) continue;
    const ageYears = Number(nowSec - a.resolvedAt) / YEAR_SECONDS;
    outcomes.push({
      id,
      kind,
      amountCents: a.amountCents,
      at: a.resolvedAt,
      counterparty: a.freelancer,
      base: BASE[kind],
      weightMult: WEIGHT_MULT[kind],
      sizeFactor: Math.min(3, Math.max(0.25, Number(a.amountCents) / 50_000)),
      recencyFactor: Math.pow(0.5, Math.max(0, ageYears)),
    });
  }

  outcomes.sort((x, y) => (x.at > y.at ? -1 : 1)); // newest first

  const concluded = outcomes.length;
  if (concluded === 0) {
    return {
      score: null,
      band: "No history",
      pct: null,
      diversityFactor: 1,
      uniqueCounterparties: 0,
      concluded: 0,
      provisional: false,
      outcomes: [],
      recoveryStreak: null,
    };
  }

  let points = 0;
  let weight = 0;
  for (const o of outcomes) {
    points += o.base * o.sizeFactor * o.recencyFactor;
    weight += o.weightMult * o.sizeFactor * o.recencyFactor;
  }
  const pct = weight > 0 ? points / weight : 0;

  const uniqueCounterparties = new Set(
    outcomes.map((o) => o.counterparty.toLowerCase()),
  ).size;
  const diversityFactor =
    concluded > 1 ? 0.6 + 0.4 * (uniqueCounterparties / concluded) : 1;

  const score = Math.round(300 + pct * diversityFactor * 550);

  // rehabilitation trend: paid streak since the newest bad mark
  let recoveryStreak: number | null = null;
  const newestBadIdx = outcomes.findIndex((o) => o.kind !== "paid");
  if (newestBadIdx > 0) recoveryStreak = newestBadIdx; // outcomes[0..idx) are paid
  else if (newestBadIdx === -1) recoveryStreak = null; // no bad marks at all

  return {
    score,
    band: bandFor(score),
    pct,
    diversityFactor,
    uniqueCounterparties,
    concluded,
    provisional: concluded < 3,
    outcomes,
    recoveryStreak,
  };
}

export function computeReputation(
  wallet: string,
  all: readonly AgreementData[],
  nowSec: bigint,
): Reputation {
  const w = wallet.toLowerCase();
  const withIds = all.map((a, i) => ({ a, id: BigInt(i) }));
  const asClientRows = withIds.filter(({ a }) => a.client.toLowerCase() === w);
  const asFreelancerRows = withIds.filter(
    ({ a }) => a.freelancer.toLowerCase() === w,
  );

  let paid = 0,
    disputed = 0,
    silentDefaults = 0,
    windowOpenDefaults = 0,
    activeC = 0;
  let volumeC = 0n;
  for (const { a } of asClientRows) {
    const kind = outcomeKind(a, nowSec);
    if (kind === "paid") paid++;
    else if (kind === "disputed") disputed++;
    else if (kind === "silent-default") silentDefaults++;
    else if (kind === "default-window-open") windowOpenDefaults++;
    else if (a.status === Status.Active) activeC++;
    if (a.cosignedAt > 0n) volumeC += a.amountCents;
  }

  let activeF = 0,
    concludedF = 0;
  let volumeF = 0n;
  for (const { a } of asFreelancerRows) {
    if (a.status === Status.Active) activeF++;
    if (outcomeKind(a, nowSec)) concludedF++;
    if (a.cosignedAt > 0n) volumeF += a.amountCents;
  }

  const involved = [...asClientRows, ...asFreelancerRows];
  const firstSeen = involved.length
    ? involved.reduce(
        (m, { a }) => (a.createdAt < m ? a.createdAt : m),
        involved[0].a.createdAt,
      )
    : null;

  return {
    asClient: {
      paid,
      disputed,
      silentDefaults,
      windowOpenDefaults,
      active: activeC,
      volumeCents: volumeC,
    },
    asFreelancer: {
      total: asFreelancerRows.length,
      active: activeF,
      concluded: concludedF,
      volumeCents: volumeF,
    },
    firstSeen,
    handshakeScore: computeScore(asClientRows, nowSec),
  };
}
