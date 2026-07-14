import {
  type AgreementData,
  DISPUTE_WINDOW_SECONDS,
  Status,
} from "./agreements";

/** One wallet's read of the registry. Everything here is derived from
 *  onchain agreement state at render time — nothing stored, nothing opaque. */
export interface Reputation {
  asClient: {
    paid: number;
    disputed: number;
    silentDefaults: number;
    pendingDefaults: number; // flagged, dispute window still open — not graded yet
    active: number;
    volumeCents: bigint;
  };
  asFreelancer: {
    total: number;
    active: number;
    concluded: number;
    volumeCents: bigint;
  };
  firstSeen: bigint | null; // earliest createdAt of any agreement they're party to
  concludedCount: number;
  grade: Grade;
}

export interface Grade {
  letter: string; // "A".."F", or "—" when no concluded history
  pct: number | null;
  provisional: boolean; // fewer than 3 concluded agreements
  // the arithmetic, spelled out for display:
  points: number;
  weight: number;
}

/**
 * The v1 grade, published in full (see README):
 *
 *   points = paid×1 + disputed×0.4 + silentDefault×0
 *   weight = paid   + disputed     + silentDefault×2
 *   pct    = points / weight
 *
 *   A ≥90% · B ≥75% · C ≥55% · D ≥35% · F below
 *
 * Silent defaults weigh double — not responding to a default flag for 14
 * days is the worst signal. Disputed outcomes get partial credit (0.4): the
 * registry doesn't rule on who's right, it just shows both claims. Fewer
 * than 3 concluded agreements marks the grade provisional. Defaults whose
 * dispute window is still open aren't graded at all yet.
 */
export function computeGrade(
  paid: number,
  disputed: number,
  silentDefaults: number,
): Grade {
  const concluded = paid + disputed + silentDefaults;
  if (concluded === 0) {
    return { letter: "—", pct: null, provisional: false, points: 0, weight: 0 };
  }
  const points = paid + disputed * 0.4;
  const weight = paid + disputed + silentDefaults * 2;
  const pct = points / weight;
  const letter =
    pct >= 0.9 ? "A" : pct >= 0.75 ? "B" : pct >= 0.55 ? "C" : pct >= 0.35 ? "D" : "F";
  return { letter, pct, provisional: concluded < 3, points, weight };
}

export function computeReputation(
  wallet: string,
  all: readonly AgreementData[],
  nowSec: bigint,
): Reputation {
  const w = wallet.toLowerCase();
  const asClientRows = all.filter((a) => a.client.toLowerCase() === w);
  const asFreelancerRows = all.filter((a) => a.freelancer.toLowerCase() === w);

  let paid = 0,
    disputed = 0,
    silentDefaults = 0,
    pendingDefaults = 0,
    activeC = 0;
  let volumeC = 0n;

  for (const a of asClientRows) {
    if (a.status === Status.Paid) paid++;
    else if (a.status === Status.Disputed) disputed++;
    else if (a.status === Status.Defaulted) {
      if (nowSec <= a.resolvedAt + DISPUTE_WINDOW_SECONDS) pendingDefaults++;
      else silentDefaults++;
    } else if (a.status === Status.Active) activeC++;
    if (a.cosignedAt > 0n) volumeC += a.amountCents;
  }

  let activeF = 0,
    concludedF = 0;
  let volumeF = 0n;
  for (const a of asFreelancerRows) {
    if (a.status === Status.Active) activeF++;
    if (
      a.status === Status.Paid ||
      a.status === Status.Defaulted ||
      a.status === Status.Disputed
    )
      concludedF++;
    if (a.cosignedAt > 0n) volumeF += a.amountCents;
  }

  const involved = [...asClientRows, ...asFreelancerRows];
  const firstSeen = involved.length
    ? involved.reduce((m, a) => (a.createdAt < m ? a.createdAt : m), involved[0].createdAt)
    : null;

  return {
    asClient: {
      paid,
      disputed,
      silentDefaults,
      pendingDefaults,
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
    concludedCount: paid + disputed + silentDefaults,
    grade: computeGrade(paid, disputed, silentDefaults),
  };
}
