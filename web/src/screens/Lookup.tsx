import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { isAddress } from "viem";
import { useAccount } from "wagmi";
import {
  type AgreementData,
  Status,
  displayStatus,
  formatCad,
  formatTimestamp,
  statusClass,
} from "../lib/agreements";
import { computeReputation, type ScoredOutcome } from "../lib/reputation";
import { useAllAgreements } from "../hooks/useAllAgreements";
import { AddressChip } from "../components/AddressChip";

const KIND_LABEL: Record<ScoredOutcome["kind"], string> = {
  paid: "paid",
  disputed: "disputed",
  "default-window-open": "default (dispute window open)",
  "silent-default": "silent default",
};

function scoreClass(band: string) {
  return `band-${band.toLowerCase().replace(" ", "-")}`;
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

  const hs = rep?.handshakeScore;

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
            <div className="rep-head">
              <AddressChip
                address={wallet}
                you={wallet.toLowerCase() === myAddress?.toLowerCase()}
              />
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
                <span className="rep-score-num">{hs.score ?? "—"}</span>
                <span className="rep-score-band">{hs.band}</span>
                {hs.provisional && hs.score !== null && (
                  <span className="rep-prov">provisional</span>
                )}
              </div>
              <div className="rep-grade-math">
                {hs.score === null ? (
                  <>
                    <strong>No payment history as a client.</strong> Unknown
                    isn't bad — it's unknown. Like any brand-new counterparty:
                    start with a smaller scope or partial payment up front.
                    Willingness to co-sign here is itself a first signal.
                  </>
                ) : (
                  <>
                    <strong>Handshake Score {hs.score}</strong> ={" "}
                    300 + {Math.round((hs.pct ?? 0) * 100)}% outcome credit ×{" "}
                    {hs.diversityFactor.toFixed(2)} diversity × 550.{" "}
                    {hs.uniqueCounterparties} unique counterpart
                    {hs.uniqueCounterparties === 1 ? "y" : "ies"} across{" "}
                    {hs.concluded} concluded. Defaults weigh double; big deals
                    count more (capped); everything fades with a 1-year
                    half-life. Same formula for everyone — arithmetic below.
                  </>
                )}
                {hs.recoveryStreak !== null && hs.recoveryStreak > 0 && (
                  <p className="rep-trend">
                    ↗ Recovering: {hs.recoveryStreak} consecutive paid since
                    the last bad mark. Old marks fade — behavior now beats
                    history.
                  </p>
                )}
              </div>
            </div>

            <div className="rep-stats">
              <div>
                <span className="rep-num">✅ {rep.asClient.paid}</span> paid
              </div>
              <div>
                <span className="rep-num">🔴 {rep.asClient.silentDefaults}</span>{" "}
                silent defaults
              </div>
              {rep.asClient.windowOpenDefaults > 0 && (
                <div>
                  <span className="rep-num">
                    🔴 {rep.asClient.windowOpenDefaults}
                  </span>{" "}
                  defaulted, window open
                </div>
              )}
              <div>
                <span className="rep-num">🟡 {rep.asClient.disputed}</span>{" "}
                disputed
              </div>
              <div>
                <span className="rep-num">{formatCad(rep.asClient.volumeCents)}</span>{" "}
                as client
              </div>
              <div>
                <span className="rep-num">
                  {formatCad(rep.asFreelancer.volumeCents)}
                </span>{" "}
                as freelancer ({rep.asFreelancer.total} gigs)
              </div>
            </div>

            {hs.outcomes.length > 0 && (
              <details className="score-breakdown">
                <summary>How this score is computed — every input</summary>
                <div className="table-wrap">
                  <table className="agreements-table">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Outcome</th>
                        <th>Amount</th>
                        <th>Credit</th>
                        <th>Size ×</th>
                        <th>Recency ×</th>
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
                          <td>{o.sizeFactor.toFixed(2)}</td>
                          <td>{o.recencyFactor.toFixed(2)}</td>
                          <td>{o.weightMult}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="field-note">
                  score = 300 + [Σ(credit·size·recency) / Σ(weight·size·recency)]
                  × diversity × 550, where diversity = 0.6 + 0.4 × (unique
                  counterparties ÷ concluded). Full spec in the README. No
                  black boxes: same public data, same formula, for everyone.
                </p>
              </details>
            )}
          </div>

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
