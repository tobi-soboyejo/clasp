import {
  type AgreementData,
  DISPUTE_WINDOW_SECONDS,
  Status,
} from "./agreements";

/**
 * The Handshake Score v2: 300–850, computed client-side from public onchain
 * state at render time. Glass-box on principle — every factor is printed on
 * the reputation card and documented in the README. The data is the
 * permanent record; the score is a published, contestable lens over it.
 *
 * Per concluded agreement (as the paying party):
 *   credit      paid = 1 · disputed = 0.4 · defaulted = 0
 *   punctuality paid on/before deadline ×1.0 · ≤7 days late ×0.85 · later ×0.7
 *   weight      defaults ×2 (disputing restores partial credit via 0.4)
 *   size        amount/$500, clamped [0.25, 3]
 *   decay       ½^(age / halfLife) — ASYMMETRIC and SIZE-SCALED:
 *               halfLife = base × (0.5 + size/2), clamped to [0.5, 3] years,
 *               base 1y paid · 1.5y disputed · 2y defaulted.
 *               Good marks fade in about a year; a big default can linger
 *               three. Rehabilitation is arithmetic, not amnesty.
 *
 *   pct       = Σ(credit·punctuality·size·decay) / Σ(weight·size·decay)
 *   diversity = 0.6 + 0.4 × (unique counterparties ÷ concluded)
 *   exposure  = open co-signed volume ÷ lifetime paid volume; every unit
 *               above 2× costs 20 points, capped at −40 (credit-utilization
 *               analog: promising much more than you've ever paid is risk)
 *
 *   score = clamp(300 + pct × diversity × 550 − exposurePenalty, 300, 850)
 */

export type OutcomeKind = "paid" | "disputed" | "default-window-open" | "silent-default";

export interface ScoredOutcome {
  id: bigint;
  kind: OutcomeKind;
  amountCents: bigint;
  at: bigint;
  counterparty: string;
  base: number;
  punctuality: number; // 1 / 0.85 / 0.7 (paid outcomes; 1 otherwise)
  weightMult: number;
  sizeFactor: number;
  halfLifeYears: number;
  recencyFactor: number;
}

export interface HandshakeScore {
  score: number | null;
  band: string;
  pct: number | null;
  diversityFactor: number;
  uniqueCounterparties: number;
  concluded: number;
  provisional: boolean;
  outcomes: ScoredOutcome[]; // newest first
  recoveryStreak: number | null;
  onTimeCount: number; // paid on/before deadline
  paidCount: number;
  openVolumeCents: bigint; // active co-signed commitments as payer
  paidVolumeCents: bigint; // lifetime confirmed-paid volume as payer
  exposureRatio: number | null; // null = no open commitments
  exposurePenalty: number; // 0..40 points
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
const WEEK_SECONDS = 7n * 24n * 3600n;

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

const DECAY_BASE_YEARS: Record<OutcomeKind, number> = {
  paid: 1,
  disputed: 1.5,
  "default-window-open": 2,
  "silent-default": 2,
};

function punctualityFor(a: AgreementData, kind: OutcomeKind): number {
  if (kind !== "paid") return 1;
  if (a.resolvedAt <= a.deadline) return 1;
  if (a.resolvedAt <= a.deadline + WEEK_SECONDS) return 0.85;
  return 0.7;
}

export function computeScore(
  rows: { a: AgreementData; id: bigint }[],
  nowSec: bigint,
): HandshakeScore {
  const outcomes: ScoredOutcome[] = [];
  let openVolumeCents = 0n;
  let paidVolumeCents = 0n;

  for (const { a, id } of rows) {
    if (a.status === Status.Active) openVolumeCents += a.amountCents;
    if (a.status === Status.Paid) paidVolumeCents += a.amountCents;

    const kind = outcomeKind(a, nowSec);
    if (!kind) continue;

    const sizeFactor = Math.min(3, Math.max(0.25, Number(a.amountCents) / 50_000));
    const halfLifeYears = Math.min(
      3,
      Math.max(0.5, DECAY_BASE_YEARS[kind] * (0.5 + sizeFactor / 2)),
    );
    const ageYears = Number(nowSec - a.resolvedAt) / YEAR_SECONDS;

    outcomes.push({
      id,
      kind,
      amountCents: a.amountCents,
      at: a.resolvedAt,
      counterparty: a.freelancer,
      base: BASE[kind],
      punctuality: punctualityFor(a, kind),
      weightMult: WEIGHT_MULT[kind],
      sizeFactor,
      halfLifeYears,
      recencyFactor: Math.pow(0.5, Math.max(0, ageYears) / halfLifeYears),
    });
  }

  outcomes.sort((x, y) => (x.at > y.at ? -1 : 1));

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
      onTimeCount: 0,
      paidCount: 0,
      openVolumeCents,
      paidVolumeCents,
      exposureRatio: null,
      exposurePenalty: 0,
    };
  }

  let points = 0;
  let weight = 0;
  for (const o of outcomes) {
    points += o.base * o.punctuality * o.sizeFactor * o.recencyFactor;
    weight += o.weightMult * o.sizeFactor * o.recencyFactor;
  }
  const pct = weight > 0 ? points / weight : 0;

  const uniqueCounterparties = new Set(
    outcomes.map((o) => o.counterparty.toLowerCase()),
  ).size;
  const diversityFactor =
    concluded > 1 ? 0.6 + 0.4 * (uniqueCounterparties / concluded) : 1;

  const exposureRatio =
    openVolumeCents === 0n
      ? null
      : paidVolumeCents > 0n
        ? Number(openVolumeCents) / Number(paidVolumeCents)
        : Number.POSITIVE_INFINITY;
  const exposurePenalty =
    exposureRatio === null || exposureRatio <= 2
      ? 0
      : Math.min(40, Math.round((Math.min(exposureRatio, 10) - 2) * 20));

  const raw = 300 + pct * diversityFactor * 550 - exposurePenalty;
  const score = Math.round(Math.min(850, Math.max(300, raw)));

  let recoveryStreak: number | null = null;
  const newestBadIdx = outcomes.findIndex((o) => o.kind !== "paid");
  if (newestBadIdx > 0) recoveryStreak = newestBadIdx;

  const paidOutcomes = outcomes.filter((o) => o.kind === "paid");

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
    onTimeCount: paidOutcomes.filter((o) => o.punctuality === 1).length,
    paidCount: paidOutcomes.length,
    openVolumeCents,
    paidVolumeCents,
    exposureRatio,
    exposurePenalty,
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

/** The track-record lens: this wallet AS THE PAID PARTY — freelancer,
 *  seller, sub-contractor, landlord, whoever delivers and gets paid. The
 *  registry records payment outcomes, so delivery quality is read through
 *  its strongest proxies: engagements the payer confirmed paying for,
 *  earnings, contested outcomes, current load — and the repeat rate, the
 *  one signal money can't fake: the same counterparty co-signing again. */
export interface WorkerRecord {
  gigsCosigned: number;
  completedPaid: number;
  earnedCents: bigint;
  disputes: number;
  defaultsSuffered: number; // times their payer defaulted on them
  activeLoad: number;
  uniqueClients: number;
  rehires: number; // counterparties who came back for 2+ co-signed deals
  firstSeen: bigint | null;
}

export function computeWorkerRecord(
  wallet: string,
  all: readonly AgreementData[],
  nowSec: bigint,
): WorkerRecord {
  const w = wallet.toLowerCase();
  const rows = all.filter(
    (a) => a.freelancer.toLowerCase() === w && a.cosignedAt > 0n,
  );

  let completedPaid = 0,
    disputes = 0,
    defaultsSuffered = 0,
    activeLoad = 0;
  let earnedCents = 0n;
  const clientCounts = new Map<string, number>();

  for (const a of rows) {
    const c = a.client.toLowerCase();
    clientCounts.set(c, (clientCounts.get(c) ?? 0) + 1);
    if (a.status === Status.Paid) {
      completedPaid++;
      earnedCents += a.amountCents;
    } else if (a.status === Status.Disputed) disputes++;
    else if (a.status === Status.Defaulted) defaultsSuffered++;
    else if (a.status === Status.Active) activeLoad++;
  }
  void nowSec;

  const rehires = [...clientCounts.values()].filter((n) => n >= 2).length;
  const firstSeen = rows.length
    ? rows.reduce((m, a) => (a.createdAt < m ? a.createdAt : m), rows[0].createdAt)
    : null;

  return {
    gigsCosigned: rows.length,
    completedPaid,
    earnedCents,
    disputes,
    defaultsSuffered,
    activeLoad,
    uniqueClients: clientCounts.size,
    rehires,
    firstSeen,
  };
}
