import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { decodeEventLog, isAddress } from "viem";
import {
  useAccount,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";
import { monadTestnet } from "wagmi/chains";
import { claspAbi } from "../lib/abi";
import { CLASP_ADDRESS, EXPLORER_URL } from "../lib/config";
import { hashText, saveScopeText, saveTxHash } from "../lib/agreements";
import { RegistryStats } from "../components/RegistryStats";

/** Deal-type presets: same contract underneath, different framing —
 *  placeholder copy and a sensible default deadline per type. */
const PRESETS = [
  {
    key: "contract",
    label: "Contract work",
    scopePh:
      "What you're delivering, by when, for how much — e.g. \"5-page site, copy included, live by the 24th, $1,850 on delivery.\"",
    days: 7,
  },
  {
    key: "virtual",
    label: "Virtual item / account",
    scopePh:
      "Item, transfer method, timing — e.g. \"Valorant account lvl 214, login + email handover within 24h of e-transfer.\"",
    days: 1,
  },
  {
    key: "rent",
    label: "Rent",
    scopePh:
      "Unit, period, amount — e.g. \"August rent, basement unit at Main St, $1,400 due the 1st.\"",
    days: null, // 1st of next month
  },
  {
    key: "custom",
    label: "Custom",
    scopePh: "Any promise to pay: what's owed, by when, for how much.",
    days: null,
  },
] as const;

function presetDeadline(key: string): string {
  const d = new Date();
  if (key === "rent") {
    const first = new Date(d.getFullYear(), d.getMonth() + 1, 1, 12, 0);
    return first.toISOString().slice(0, 16);
  }
  const preset = PRESETS.find((p) => p.key === key);
  if (!preset?.days) return "";
  const t = new Date(d.getTime() + preset.days * 86_400_000);
  t.setMinutes(0);
  return t.toISOString().slice(0, 16);
}

export function NewAgreement() {
  const { address, isConnected, chainId } = useAccount();
  const onMonad = chainId === monadTestnet.id;

  const [client, setClient] = useState("");
  const [amount, setAmount] = useState("");
  const [deadline, setDeadline] = useState("");
  const [scope, setScope] = useState("");
  const [preset, setPreset] = useState<string>("contract");
  const [formError, setFormError] = useState<string | null>(null);

  const { writeContract, data: txHash, isPending, error: writeError, reset } =
    useWriteContract();
  const { data: receipt, isLoading: isConfirming } =
    useWaitForTransactionReceipt({ hash: txHash });

  const createdId = useMemo(() => {
    if (!receipt) return undefined;
    for (const log of receipt.logs) {
      try {
        const decoded = decodeEventLog({
          abi: claspAbi,
          data: log.data,
          topics: log.topics,
        });
        if (decoded.eventName === "AgreementCreated") {
          return (decoded.args as { id: bigint }).id;
        }
      } catch {
        // not our event
      }
    }
    return undefined;
  }, [receipt]);

  // Persist scope text + creation tx locally once the id is known
  // (v1 off-chain storage; see README limitations).
  useMemo(() => {
    if (createdId !== undefined && scope) saveScopeText(createdId, scope);
    if (createdId !== undefined && txHash) saveTxHash(createdId, "created", txHash);
  }, [createdId, scope, txHash]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    if (!isAddress(client)) return setFormError("Client wallet address isn't valid.");
    if (address && client.toLowerCase() === address.toLowerCase())
      return setFormError("You can't propose an agreement with yourself.");
    const amountNum = Number(amount);
    if (!Number.isFinite(amountNum) || amountNum <= 0)
      return setFormError("Amount must be a positive number of dollars.");
    const deadlineSec = Math.floor(new Date(deadline).getTime() / 1000);
    if (!deadline || Number.isNaN(deadlineSec))
      return setFormError("Pick a deadline.");
    if (deadlineSec <= Math.floor(Date.now() / 1000))
      return setFormError("Deadline must be in the future.");
    if (!scope.trim()) return setFormError("Describe the scope of work.");

    writeContract({
      address: CLASP_ADDRESS,
      abi: claspAbi,
      functionName: "createAgreement",
      args: [
        client as `0x${string}`,
        BigInt(Math.round(amountNum * 100)),
        BigInt(deadlineSec),
        hashText(scope),
      ],
    });
  }

  if (createdId !== undefined) {
    const link = `${window.location.origin}/agreement/${createdId}`;
    return (
      <section>
        <h1>Agreement proposed ✓</h1>
        <p className="tagline">
          It counts for nothing until your client co-signs. Send them this
          link — their signature is what puts the commitment on the record.
        </p>
        <div className="share-box">
          <code>{link}</code>
          <button
            className="connect-btn"
            onClick={() => navigator.clipboard.writeText(link)}
          >
            Copy link
          </button>
        </div>
        <p className="registry-stats">
          <a
            href={`${EXPLORER_URL}/tx/${txHash}`}
            target="_blank"
            rel="noreferrer"
          >
            View transaction
          </a>{" "}
          · <Link to={`/agreement/${createdId}`}>Open agreement #{createdId.toString()}</Link>
        </p>
        <button
          className="link-btn"
          onClick={() => {
            reset();
            setClient("");
            setAmount("");
            setDeadline("");
            setScope("");
          }}
        >
          Propose another
        </button>
      </section>
    );
  }

  return (
    <section>
      <h1>Propose an agreement</h1>
      <p className="tagline">
        The credit check for gig work and digital deals: both parties sign
        the commitment onchain before work starts — the outcome becomes
        permanent, public history. Freelance jobs, game-account sales, any
        promise to pay.
      </p>

      <div className="preset-chips">
        {PRESETS.map((p) => (
          <button
            key={p.key}
            type="button"
            className={`preset-chip ${preset === p.key ? "active" : ""}`}
            onClick={() => {
              setPreset(p.key);
              const suggested = presetDeadline(p.key);
              if (suggested) setDeadline(suggested);
            }}
          >
            {p.label}
          </button>
        ))}
      </div>

      <form className="agreement-form" onSubmit={submit}>
        <label>
          Your client's wallet address
          <input
            value={client}
            onChange={(e) => setClient(e.target.value.trim())}
            placeholder="0x…"
            spellCheck={false}
          />
          <span className="field-note">
            Think of it as their account number. They can copy it from their
            wallet app (MetaMask etc.) and text it to you.
          </span>
        </label>
        <label>
          Amount (CAD)
          <input
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            type="number"
            min="0.01"
            step="0.01"
            placeholder="2000.00"
          />
        </label>
        <label>
          Payment deadline
          <input
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
            type="datetime-local"
          />
        </label>
        <label>
          {preset === "virtual" ? "What's being sold" : preset === "rent" ? "What's owed" : "Scope of work"}
          <textarea
            value={scope}
            onChange={(e) => setScope(e.target.value)}
            rows={5}
            placeholder={PRESETS.find((p) => p.key === preset)?.scopePh}
          />
          <span className="field-note">
            Only a fingerprint (keccak256 hash) of this text goes onchain. The
            text itself stays in your browser — share it with your client
            separately.
          </span>
        </label>

        {!isConnected && (
          <p className="form-hint">Connect your wallet (top right) to propose.</p>
        )}
        {isConnected && !onMonad && (
          <p className="form-hint">Switch to Monad Testnet (top right) to propose.</p>
        )}
        {formError && <p className="form-error">{formError}</p>}
        {writeError && (
          <p className="form-error">
            {writeError.message.split("\n")[0]}
          </p>
        )}

        <button
          type="submit"
          className="connect-btn"
          disabled={!isConnected || !onMonad || isPending || isConfirming}
        >
          {isPending
            ? "Confirm in wallet…"
            : isConfirming
              ? "Waiting for the chain…"
              : "Propose agreement"}
        </button>
      </form>

      <RegistryStats />
    </section>
  );
}
