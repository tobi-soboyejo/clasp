import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { isAddress } from "viem";
import {
  useAccount,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";
import {
  type AgreementData,
  Status,
  displayStatus,
  formatCad,
  formatTimestamp,
  statusClass,
} from "../lib/agreements";
import { shortAddress } from "../lib/agreements";
import { CLASP_ADDRESS, BOARD_ADDRESS, PROFILE_ADDRESS } from "../lib/config";
import { boardAbi } from "../lib/abi-board";
import { claspProfileAbi } from "../lib/abi-profile";
import { useReadContract } from "wagmi";
import {
  computeReputation,
  computeWorkerRecord,
  type ScoredOutcome,
} from "../lib/reputation";

import { useAllAgreements } from "../hooks/useAllAgreements";
import { AddressChip } from "../components/AddressChip";
import { GlowBorder, BAND_GLOW } from "../components/GlowBorder";

const KIND_LABEL: Record<ScoredOutcome["kind"], string> = {
  paid: "paid",
  disputed: "disputed",
  "default-window-open": "default (dispute window open)",
  "silent-default": "silent default",
};

/** Work links this wallet attached to its board listings — portfolio URLs,
 *  screenshots of items for sale, past jobs. Image URLs render as previews. */
const IMG_RE = /\.(png|jpe?g|webp|gif|avif)(\?|$)/i;

function WorkLinks({ wallet }: { wallet: string }) {
  const { data } = useReadContract({
    address: BOARD_ADDRESS,
    abi: boardAbi,
    functionName: "getListings",
    args: [0n, 1_000_000n],
  });
  const listings = (data as
    | readonly { poster: string; link: string; title: string; active: boolean }[]
    | undefined) ?? [];
  const links = listings.filter(
    (l) =>
      l.active && l.link && l.poster.toLowerCase() === wallet.toLowerCase(),
  );
  if (links.length === 0) return null;
  return (
    <div className="work-links">
      {links.map((l, i) =>
        IMG_RE.test(l.link) ? (
          <a key={i} href={l.link} target="_blank" rel="noreferrer" title={l.title}>
            <img src={l.link} alt={l.title} loading="lazy" />
          </a>
        ) : (
          <a
            key={i}
            className="work-link-card"
            href={l.link}
            target="_blank"
            rel="noreferrer"
            title={l.title}
          >
            {l.link.replace(/^https?:\/\//, "")}
          </a>
        ),
      )}
    </div>
  );
}

/** Publish (or update) your self-declared name — a real onchain tx. The
 *  address stays visible everywhere; the name only annotates it. */
function SetPublicName() {
  const { writeContract, data: txHash, isPending } = useWriteContract();
  const { isLoading: confirming, isSuccess } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  function run() {
    const name = window.prompt(
      "Public display name for your wallet (shown next to your address, max 40 bytes; empty clears it):",
    );
    if (name === null) return;
    const link = window.prompt("Optional link (portfolio/site), or leave empty:", "") ?? "";
    writeContract({
      address: PROFILE_ADDRESS,
      abi: claspProfileAbi,
      functionName: "setProfile",
      args: [name.trim(), link.trim()],
    });
  }

  return (
    <button className="link-btn" style={{ marginTop: 0 }} onClick={run} disabled={isPending || confirming}>
      {isPending || confirming ? "Publishing name…" : isSuccess ? "Name published ✓" : "Set public name"}
    </button>
  );
}

function scoreClass(band: string) {
  return `band-${band.toLowerCase().replace(" ", "-")}`;
}

/** The stamp doesn't just appear — it counts up from 300, like a meter
 *  settling. ~650ms, ease-out, respects prefers-reduced-motion. */
function ScoreNumber({ value }: { value: number }) {
  const [shown, setShown] = useState(300);
  const raf = useRef(0);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setShown(value);
      return;
    }
    const start = performance.now();
    const from = 300;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / 650);
      const eased = 1 - Math.pow(1 - p, 3);
      setShown(Math.round(from + (value - from) * eased));
      if (p < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [value]);

  return <>{shown}</>;
}

export function Lookup() {
  const { address: addressParam } = useParams();
  const navigate = useNavigate();
  const { address: myAddress } = useAccount();
  const [input, setInput] = useState(addressParam ?? "");
  const [inputError, setInputError] = useState<string | null>(null);

  const { data: all, isLoading, error } = useAllAgreements();

  const wallet =
    addressParam && isAddress(addressParam) ? addressParam : undefined;

  const nowSec = BigInt(Math.floor(Date.now() / 1000));

  const rep = useMemo(() => {
    if (!wallet || !all) return undefined;
    return computeReputation(wallet, all, BigInt(Math.floor(Date.now() / 1000)));
  }, [wallet, all]);

  const rows = useMemo(() => {
    if (!wallet || !all) return [];
    const w = wallet.toLowerCase();
    return all
      .map((a, i) => ({ a, id: BigInt(i) }))
      .filter(
        ({ a }) =>
          a.client.toLowerCase() === w || a.freelancer.toLowerCase() === w,
      );
  }, [wallet, all]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setInputError(null);
    if (!isAddress(input.trim())) {
      setInputError("That's not a valid wallet address (0x…, 42 characters).");
      return;
    }
    navigate(`/lookup/${input.trim()}`);
  }

  const hs = rep?.claspScore;

  return (
    <section>
      <h1>Look up a wallet</h1>
      <p className="tagline">
        The check you run before you take the job or send the money. Paste
        any wallet address — its whole co-signed history is public.
      </p>

      <form className="lookup-form" onSubmit={submit}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="0x…"
          spellCheck={false}
        />
        <button type="submit" className="connect-btn">
          Check history
        </button>
        {myAddress && (
          <button
            type="button"
            className="link-btn"
            onClick={() => {
              setInput(myAddress);
              navigate(`/lookup/${myAddress}`);
            }}
          >
            My wallet
          </button>
        )}
      </form>
      {inputError && <p className="form-error">{inputError}</p>}
      {addressParam && !wallet && (
        <p className="form-error">"{addressParam}" isn't a valid address.</p>
      )}
      {isLoading && wallet && <p className="field-note">Reading the registry…</p>}
      {error && <p className="form-error">Couldn't reach Monad testnet.</p>}

      {wallet && rep && hs && (
        <>
          <div className="rep-card">
            <div className="report-banner">
              <span>Payment history report</span>
              <span>
                pulled{" "}
                {new Date().toLocaleString("en-CA", {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}{" "}
                · registry {shortAddress(CLASP_ADDRESS)}
              </span>
            </div>
            <div className="rep-body">
            <div className="rep-head">
              <AddressChip
                address={wallet}
                you={wallet.toLowerCase() === myAddress?.toLowerCase()}
              />
              {wallet.toLowerCase() === myAddress?.toLowerCase() && (
                <SetPublicName />
              )}
              <span className="rep-first-seen">
                {rep.firstSeen !== null ? (
                  <>
                    first seen {formatTimestamp(rep.firstSeen)} ·{" "}
                    {hs.concluded} concluded
                  </>
                ) : (
                  "never seen in this registry"
                )}
              </span>
            </div>

            <div className="rep-grade-row">
              <div className={`rep-score ${scoreClass(hs.band)}`}>
                <GlowBorder
                  colors={BAND_GLOW[hs.band.toLowerCase().replace(" ", "-")] ?? BAND_GLOW["no-history"]}
                  borderRadius={26}
                  inset={-12}
                  intensity={0.75}
                />
                <span className="rep-score-num">
                  {hs.score !== null ? <ScoreNumber value={hs.score} /> : "—"}
                </span>
                <span className="rep-score-band">{hs.band}</span>
                {hs.provisional && hs.score !== null && (
                  <span className="rep-prov">provisional</span>
                )}
              </div>
              <div className="rep-grade-math">
                {hs.score === null ? (
                  <>
                    <strong className="verdict">
                      No payment history as a payer.
                    </strong>
                    <p className="verdict-line">
                      Unknown isn't bad — it's unknown. Treat them like any
                      new counterparty: smaller first scope, partial payment
                      up front. Willingness to co-sign is itself a first
                      signal.
                    </p>
                  </>
                ) : (
                  <>
                    <strong className="verdict">
                      {hs.band === "Excellent" && "Pays, on time, consistently."}
                      {hs.band === "Good" && "Solid payment record."}
                      {hs.band === "Fair" && "Mixed record — set clear terms."}
                      {hs.band === "Poor" && "Elevated risk. Protect yourself."}
                      {hs.band === "Bad" && "High risk of non-payment."}
                    </strong>
                    <ul className="verdict-facts">
                      {hs.paidCount > 0 && (
                        <li>
                          Paid on time {hs.onTimeCount} of {hs.paidCount}{" "}
                          confirmed deals.
                        </li>
                      )}
                      {(rep.asClient.windowOpenDefaults > 0 ||
                        rep.asClient.silentDefaults > 0) && (
                        <li>
                          {rep.asClient.silentDefaults + rep.asClient.windowOpenDefaults}{" "}
                          default
                          {rep.asClient.silentDefaults + rep.asClient.windowOpenDefaults === 1
                            ? ""
                            : "s"}{" "}
                          on record
                          {rep.asClient.windowOpenDefaults > 0 &&
                            " — dispute window still open on the latest"}
                          .
                        </li>
                      )}
                      {hs.openVolumeCents > 0n && (
                        <li>
                          {formatCad(hs.openVolumeCents)} in open commitments
                          vs {formatCad(hs.paidVolumeCents)} ever paid
                          {hs.exposurePenalty > 0 &&
                            ` — over-extended, −${hs.exposurePenalty} pts`}
                          .
                        </li>
                      )}
                      {hs.recoveryStreak !== null && hs.recoveryStreak > 0 && (
                        <li className="rep-trend">
                          Recovering: {hs.recoveryStreak} consecutive paid
                          since the last bad mark.
                        </li>
                      )}
                    </ul>
                  </>
                )}
              </div>
            </div>

            <div className="rep-stats">
              <div className="stat-box stat-glow" style={{ "--glow": "#74c887" } as React.CSSProperties}>
                <span className="stat-inner">
                  <span className="pip pip-ok" />
                  <span className="rep-num">{rep.asClient.paid}</span> paid
                </span>
              </div>
              <div className="stat-box stat-glow" style={{ "--glow": "#ec8873" } as React.CSSProperties}>
                <span className="stat-inner">
                  <span className="pip pip-bad" />
                  <span className="rep-num">{rep.asClient.silentDefaults}</span>{" "}
                  silent defaults
                </span>
              </div>
              {rep.asClient.windowOpenDefaults > 0 && (
                <div className="stat-box stat-glow" style={{ "--glow": "#ec8873" } as React.CSSProperties}>
                  <span className="stat-inner">
                    <span className="pip pip-bad" />
                    <span className="rep-num">
                      {rep.asClient.windowOpenDefaults}
                    </span>{" "}
                    defaulted, window open
                  </span>
                </div>
              )}
              <div className="stat-box stat-glow" style={{ "--glow": "#e0c46e" } as React.CSSProperties}>
                <span className="stat-inner">
                  <span className="pip pip-warn" />
                  <span className="rep-num">{rep.asClient.disputed}</span>{" "}
                  disputed
                </span>
              </div>
              <div className="stat-box stat-plain">
                <span className="stat-inner">
                  <span className="rep-num">{formatCad(rep.asClient.volumeCents)}</span>{" "}
                  as client
                </span>
              </div>
              <div className="stat-box stat-plain">
                <span className="stat-inner">
                  <span className="rep-num">
                    {formatCad(rep.asFreelancer.volumeCents)}
                  </span>{" "}
                  as freelancer ({rep.asFreelancer.total} gigs)
                </span>
              </div>
            </div>

            {hs.outcomes.length > 0 && (
              <details className="score-breakdown">
                <summary>How this score is computed — every input</summary>
                <p className="field-note" style={{ margin: "0.6rem 0" }}>
                  <strong>Clasp Score {hs.score}</strong> = 300 +{" "}
                  {Math.round((hs.pct ?? 0) * 100)}% outcome credit ×{" "}
                  {hs.diversityFactor.toFixed(2)} diversity × 550
                  {hs.exposurePenalty > 0 && ` − ${hs.exposurePenalty} exposure`}
                  . {hs.uniqueCounterparties} unique counterpart
                  {hs.uniqueCounterparties === 1 ? "y" : "ies"} across{" "}
                  {hs.concluded} concluded. Defaults weigh double and decay
                  slowest; late payment earns partial credit; bigger deals
                  both count more and linger longer (half-life 0.5–3 years).
                  Same public data, same formula, for everyone.
                </p>
                <div className="table-wrap">
                  <table className="agreements-table">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Outcome</th>
                        <th>Amount</th>
                        <th>Credit</th>
                        <th>On time ×</th>
                        <th>Size ×</th>
                        <th>Half-life</th>
                        <th>Decay ×</th>
                        <th>Weight ×</th>
                      </tr>
                    </thead>
                    <tbody>
                      {hs.outcomes.map((o) => (
                        <tr key={o.id.toString()}>
                          <td>
                            <Link to={`/agreement/${o.id}`}>
                              #{o.id.toString()}
                            </Link>
                          </td>
                          <td>{KIND_LABEL[o.kind]}</td>
                          <td>{formatCad(o.amountCents)}</td>
                          <td>{o.base}</td>
                          <td>{o.kind === "paid" ? o.punctuality.toFixed(2) : "—"}</td>
                          <td>{o.sizeFactor.toFixed(2)}</td>
                          <td>{o.halfLifeYears.toFixed(1)}y</td>
                          <td>{o.recencyFactor.toFixed(2)}</td>
                          <td>{o.weightMult}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="field-note">
                  score = 300 + [Σ(credit·punctuality·size·decay) /
                  Σ(weight·size·decay)] × diversity × 550 − exposure, where
                  diversity = 0.6 + 0.4 × (unique ÷ concluded) and exposure
                  docks up to 40 pts when open commitments exceed 2× lifetime
                  paid volume. Full spec in the README.
                </p>
              </details>
            )}
            </div>
          </div>

          {(() => {
            const wr = computeWorkerRecord(wallet, all!, nowSec);
            if (wr.gigsCosigned === 0) return null;
            return (
              <div className="worker-card">
                <div className="worker-title">
                  Track record — this wallet as the paid party
                </div>
                <div className="rep-stats" style={{ borderTop: "none", paddingTop: 0 }}>
                  <div>
                    <span className="pip pip-ok" />
                    <span className="rep-num">{wr.completedPaid}</span>{" "}
                    delivered &amp; paid
                  </div>
                  <div>
                    <span className="rep-num">{formatCad(wr.earnedCents)}</span>{" "}
                    earned
                  </div>
                  <div>
                    <span className="pip pip-warn" />
                    <span className="rep-num">{wr.disputes}</span> contested
                  </div>
                  <div>
                    <span className="pip pip-dim" />
                    <span className="rep-num">{wr.activeLoad}</span> active now
                  </div>
                  <div>
                    <span className="rep-num">
                      {wr.rehires}/{wr.uniqueClients}
                    </span>{" "}
                    counterparties came back
                  </div>
                </div>
                <WorkLinks wallet={wallet} />
                <p className="field-note" style={{ marginTop: "0.7rem" }}>
                  Vetting them as a freelancer, seller, sub-contractor, or
                  landlord? Payment confirmations double as delivery
                  evidence — a payer confirming is a payer who accepted what
                  they got. Repeat counterparties are the signal that can't
                  be faked cheaply. ({wr.defaultsSuffered} time
                  {wr.defaultsSuffered === 1 ? "" : "s"} a payer defaulted on
                  them — that mark belongs to the payer, not this wallet.)
                </p>
              </div>
            );
          })()}

          <h2>Agreements ({rows.length})</h2>
          {rows.length === 0 && (
            <p className="field-note">
              This wallet has never co-signed anything here. A blank record is
              itself information — and if someone refuses to co-sign at all,
              that's your answer.
            </p>
          )}
          {rows.length > 0 && (
            <div className="table-wrap">
              <table className="agreements-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Role</th>
                    <th>Counterparty</th>
                    <th>Amount</th>
                    <th>Deadline</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(({ a, id }) => {
                    const isClientRow =
                      a.client.toLowerCase() === wallet.toLowerCase();
                    const label = displayStatus(a as AgreementData, nowSec);
                    return (
                      <tr key={id.toString()}>
                        <td>
                          <Link to={`/agreement/${id}`}>#{id.toString()}</Link>
                        </td>
                        <td>{isClientRow ? "client" : "freelancer"}</td>
                        <td>
                          <AddressChip
                            address={isClientRow ? a.freelancer : a.client}
                          />
                        </td>
                        <td>{formatCad(a.amountCents)}</td>
                        <td>{formatTimestamp(a.deadline)}</td>
                        <td>
                          <span className={`status-badge ${statusClass(label)}`}>
                            {label}
                          </span>
                          {a.status === Status.Proposed && label !== "Expired" && (
                            <span className="field-note"> not co-signed yet</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </section>
  );
}
