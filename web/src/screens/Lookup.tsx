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
import { computeReputation } from "../lib/reputation";
import { useAllAgreements } from "../hooks/useAllAgreements";
import { AddressChip } from "../components/AddressChip";

export function Lookup() {
  const { address: addressParam } = useParams();
  const navigate = useNavigate();
  const { address: myAddress } = useAccount();
  const [input, setInput] = useState(addressParam ?? "");
  const [inputError, setInputError] = useState<string | null>(null);

  const { data: all, isLoading, error } = useAllAgreements();

  const wallet =
    addressParam && isAddress(addressParam) ? addressParam : undefined;

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

  const nowSec = BigInt(Math.floor(Date.now() / 1000));

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

      {wallet && rep && (
        <>
          <div className="rep-card">
            <div className="rep-head">
              <AddressChip address={wallet} you={wallet.toLowerCase() === myAddress?.toLowerCase()} />
              <span className="rep-first-seen">
                {rep.firstSeen !== null ? (
                  <>first seen {formatTimestamp(rep.firstSeen)} · {rep.concludedCount} concluded</>
                ) : (
                  "never seen in this registry"
                )}
              </span>
            </div>

            <div className="rep-grade-row">
              <div className={`rep-grade grade-${rep.grade.letter === "—" ? "none" : rep.grade.letter}`}>
                {rep.grade.letter}
                {rep.grade.provisional && <span className="rep-prov">provisional</span>}
              </div>
              <div className="rep-grade-math">
                {rep.grade.pct === null ? (
                  <>
                    <strong>No payment history as a client.</strong> Unknown
                    isn't bad — it's unknown. Like any brand-new counterparty:
                    start with a smaller scope or partial payment up front.
                  </>
                ) : (
                  <>
                    <strong>{Math.round(rep.grade.pct * 100)}%</strong> ={" "}
                    {rep.asClient.paid} paid ×1 + {rep.asClient.disputed} disputed
                    ×0.4 + {rep.asClient.silentDefaults} silent ×0, out of a
                    weight of {rep.grade.weight} (silent defaults count double).
                    Same formula for everyone, arithmetic shown — this registry
                    doesn't do black boxes.
                  </>
                )}
              </div>
            </div>

            <div className="rep-stats">
              <div>
                <span className="rep-num">✅ {rep.asClient.paid}</span> paid
              </div>
              <div>
                <span className="rep-num">🔴 {rep.asClient.silentDefaults}</span> silent defaults
              </div>
              <div>
                <span className="rep-num">🟡 {rep.asClient.disputed}</span> disputed
              </div>
              {rep.asClient.pendingDefaults > 0 && (
                <div>
                  <span className="rep-num">⏳ {rep.asClient.pendingDefaults}</span> flagged, dispute window open
                </div>
              )}
              <div>
                <span className="rep-num">{formatCad(rep.asClient.volumeCents)}</span> as client
              </div>
              <div>
                <span className="rep-num">{formatCad(rep.asFreelancer.volumeCents)}</span> as freelancer
                ({rep.asFreelancer.total} gigs)
              </div>
            </div>
          </div>

          <h2>Agreements ({rows.length})</h2>
          {rows.length === 0 && (
            <p className="field-note">
              This wallet has never co-signed anything here. A blank record is
              itself information.
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
                    const isClientRow = a.client.toLowerCase() === wallet.toLowerCase();
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
