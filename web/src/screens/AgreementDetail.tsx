import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import {
  useAccount,
  useReadContract,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";
import { monadTestnet } from "wagmi/chains";
import { handshakeAbi } from "../lib/abi";
import { HANDSHAKE_ADDRESS, EXPLORER_URL } from "../lib/config";
import {
  type AgreementData,
  DISPUTE_WINDOW_SECONDS,
  Status,
  displayStatus,
  statusClass,
  formatCad,
  formatTimestamp,
  hashText,
  loadDisputeText,
  loadScopeText,
  loadTxHash,
  saveDisputeText,
  saveTxHash,
  timeline,
  type TxKey,
} from "../lib/agreements";
import { AddressChip } from "../components/AddressChip";

export function AgreementDetail() {
  const { id: idParam } = useParams();
  const id = useMemo(() => {
    try {
      return idParam !== undefined ? BigInt(idParam) : undefined;
    } catch {
      return undefined;
    }
  }, [idParam]);

  const { address, chainId } = useAccount();
  const onMonad = chainId === monadTestnet.id;

  const {
    data: agreement,
    error: readError,
    isLoading,
    refetch,
  } = useReadContract({
    address: HANDSHAKE_ADDRESS,
    abi: handshakeAbi,
    functionName: "getAgreement",
    args: id !== undefined ? [id] : undefined,
    query: { enabled: id !== undefined, refetchInterval: 15_000 },
  });

  const [disputeReason, setDisputeReason] = useState("");
  const [showDisputeForm, setShowDisputeForm] = useState(false);
  const [pendingTxKey, setPendingTxKey] = useState<TxKey | null>(null);

  const { writeContract, data: txHash, isPending, error: writeError } =
    useWriteContract();
  const { isLoading: isConfirming, isSuccess: txLanded } =
    useWaitForTransactionReceipt({ hash: txHash });

  useEffect(() => {
    if (txLanded) {
      if (id !== undefined && txHash && pendingTxKey) {
        saveTxHash(id, pendingTxKey, txHash);
      }
      refetch();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [txLanded]);

  if (id === undefined) return <section><h1>Not a valid agreement id</h1></section>;
  if (isLoading) return <section><p className="tagline">Reading the chain…</p></section>;
  if (readError || !agreement) {
    return (
      <section>
        <h1>Agreement #{idParam}</h1>
        <p className="form-error">
          No agreement with this id exists in the registry.
        </p>
      </section>
    );
  }

  const a = agreement as AgreementData;
  const nowSec = BigInt(Math.floor(Date.now() / 1000));
  const label = displayStatus(a, nowSec);

  const me = address?.toLowerCase();
  const isClient = me === a.client.toLowerCase();
  const isFreelancer = me === a.freelancer.toLowerCase();

  const scopeText = loadScopeText(id);
  const scopeVerified = scopeText !== null && hashText(scopeText) === a.scopeHash;
  const disputeText = loadDisputeText(id);
  const disputeVerified =
    disputeText !== null &&
    a.disputeHash !== "0x0000000000000000000000000000000000000000000000000000000000000000" &&
    hashText(disputeText) === a.disputeHash;

  const disputeDeadline = a.resolvedAt + DISPUTE_WINDOW_SECONDS;
  const canCosign = isClient && a.status === Status.Proposed && nowSec <= a.deadline;
  const canConfirm = isClient && a.status === Status.Active;
  const canFlag = isFreelancer && a.status === Status.Active && nowSec > a.deadline;
  const canDispute =
    isClient && a.status === Status.Defaulted && nowSec <= disputeDeadline;

  const busy = isPending || isConfirming;
  const write = (functionName: "cosign" | "confirmPaid" | "flagDefault") => {
    setPendingTxKey(functionName === "cosign" ? "cosigned" : "resolved");
    writeContract({ address: HANDSHAKE_ADDRESS, abi: handshakeAbi, functionName, args: [id] });
  };

  function submitDispute() {
    if (!disputeReason.trim()) return;
    saveDisputeText(id!, disputeReason);
    setPendingTxKey("disputed");
    writeContract({
      address: HANDSHAKE_ADDRESS,
      abi: handshakeAbi,
      functionName: "dispute",
      args: [id!, hashText(disputeReason)],
    });
  }

  return (
    <section>
      <div className="detail-head">
        <h1>Agreement #{id.toString()}</h1>
        <span className={`status-badge ${statusClass(label)}`}>{label}</span>
      </div>

      <dl className="terms">
        <div>
          <dt>Freelancer (gets paid)</dt>
          <dd>
            <AddressChip address={a.freelancer} you={isFreelancer} />
          </dd>
        </div>
        <div>
          <dt>Client (pays)</dt>
          <dd>
            <AddressChip address={a.client} you={isClient} />
          </dd>
        </div>
        <div>
          <dt>Amount</dt>
          <dd>{formatCad(a.amountCents)}</dd>
        </div>
        <div>
          <dt>Payment deadline</dt>
          <dd>{formatTimestamp(a.deadline)}</dd>
        </div>
        {a.status === Status.Defaulted && nowSec <= disputeDeadline && (
          <div>
            <dt>Dispute window closes</dt>
            <dd>{formatTimestamp(disputeDeadline)}</dd>
          </div>
        )}
      </dl>

      <div className="scope-box">
        <h2>Scope of work</h2>
        {scopeText ? (
          <>
            <p className="scope-text">{scopeText}</p>
            <p className={scopeVerified ? "verify-ok" : "verify-bad"}>
              {scopeVerified
                ? "✓ matches the onchain fingerprint"
                : "✗ does NOT match the onchain fingerprint — text was altered"}
            </p>
          </>
        ) : (
          <p className="field-note">
            Scope text isn't stored onchain (only its fingerprint{" "}
            <code>{a.scopeHash.slice(0, 10)}…</code>) and isn't saved on this
            device. Ask the proposer for the text; this page will verify it
            against the fingerprint.
          </p>
        )}
        {disputeVerified && (
          <>
            <h2>Client's dispute reason</h2>
            <p className="scope-text">{disputeText}</p>
            <p className="verify-ok">✓ matches the onchain fingerprint</p>
          </>
        )}
      </div>

      {(canCosign || canConfirm || canFlag || canDispute) && onMonad && (
        <div className="action-box">
          {canCosign && (
            <>
              <p className="form-hint">
                Co-signing puts this commitment on the permanent record —
                for both of you.
              </p>
              <button className="connect-btn" disabled={busy} onClick={() => write("cosign")}>
                {busy ? "Signing…" : "Co-sign agreement"}
              </button>
            </>
          )}
          {canConfirm && (
            <>
              <p className="form-hint">
                Confirming payment closes this agreement as a good mark — for
                your own record too.
              </p>
              <button className="connect-btn" disabled={busy} onClick={() => write("confirmPaid")}>
                {busy ? "Confirming…" : "Confirm payment sent"}
              </button>
            </>
          )}
          {canFlag && (
            <>
              <p className="form-hint">
                The deadline has passed. Flagging a default starts the
                client's 14-day dispute window.
              </p>
              <button
                className="connect-btn danger"
                disabled={busy}
                onClick={() => write("flagDefault")}
              >
                {busy ? "Flagging…" : "Flag default"}
              </button>
            </>
          )}
          {canDispute && !showDisputeForm && (
            <button className="connect-btn" onClick={() => setShowDisputeForm(true)}>
              Dispute this default
            </button>
          )}
          {canDispute && showDisputeForm && (
            <>
              <label>
                Why is this default flag wrong?
                <textarea
                  rows={4}
                  value={disputeReason}
                  onChange={(e) => setDisputeReason(e.target.value)}
                  placeholder="Your side of the story. Its fingerprint goes onchain; the registry never rules on who's right — both claims stay visible."
                />
              </label>
              <button
                className="connect-btn"
                disabled={busy || !disputeReason.trim()}
                onClick={submitDispute}
              >
                {busy ? "Submitting…" : "Submit dispute"}
              </button>
            </>
          )}
        </div>
      )}

      {(canCosign || canConfirm || canFlag || canDispute) && !onMonad && address && (
        <p className="form-hint">Switch to Monad Testnet (top right) to act on this agreement.</p>
      )}

      {writeError && (
        <p className="form-error">{writeError.message.split("\n")[0]}</p>
      )}

      <h2>Onchain history</h2>
      <ol className="timeline">
        {timeline(a).map((step) => {
          const stepTx = loadTxHash(id, step.txKey);
          return (
            <li key={step.txKey + step.label}>
              <span className="timeline-label">{step.label}</span>
              <span className="timeline-when">{formatTimestamp(step.timestamp)}</span>
              {stepTx && (
                <a
                  href={`${EXPLORER_URL}/tx/${stepTx}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  tx ↗
                </a>
              )}
            </li>
          );
        })}
      </ol>
      <p className="field-note">
        Timestamps read from contract state.{" "}
        <a
          href={`${EXPLORER_URL}/address/${HANDSHAKE_ADDRESS}`}
          target="_blank"
          rel="noreferrer"
        >
          All registry transactions on the explorer ↗
        </a>
      </p>
    </section>
  );
}
