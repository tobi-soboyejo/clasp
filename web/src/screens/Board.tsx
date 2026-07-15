import { useState } from "react";
import { Link } from "react-router-dom";
import {
  useAccount,
  useReadContract,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";
import { monadTestnet } from "wagmi/chains";
import { boardAbi } from "../lib/abi-board";
import { BOARD_ADDRESS } from "../lib/config";
import { formatCad, formatTimestamp } from "../lib/agreements";
import { computeReputation, computeWorkerRecord } from "../lib/reputation";
import { useAllAgreements } from "../hooks/useAllAgreements";
import { AddressChip } from "../components/AddressChip";

interface ListingData {
  poster: `0x${string}`;
  kind: number; // 0 offering, 1 seeking
  category: number;
  title: string;
  details: string;
  link: string;
  rateCents: bigint;
  postedAt: bigint;
  active: boolean;
}

export const CATEGORY_LABELS = [
  "Services",
  "Trades & field",
  "Creative & digital",
  "Goods & gaming",
  "Rentals & property",
  "Other",
];

const IMAGE_RE = /\.(png|jpe?g|webp|gif|avif)(\?|$)/i;

function LinkPreview({ url }: { url: string }) {
  if (IMAGE_RE.test(url)) {
    return (
      <a href={url} target="_blank" rel="noreferrer">
        <img src={url} alt="attached work" loading="lazy" />
      </a>
    );
  }
  return (
    <a className="work-link-card" href={url} target="_blank" rel="noreferrer">
      {url.replace(/^https?:\/\//, "")}
    </a>
  );
}

/** Hiring listings show the poster's payer score; offering-work listings
 *  show their delivery track record — each side vetted on what matters. */
function ScoreChip({ wallet, kind }: { wallet: string; kind: number }) {
  const { data: all } = useAllAgreements();
  if (!all) return null;
  const nowSec = BigInt(Math.floor(Date.now() / 1000));

  if (kind === 0) {
    const wr = computeWorkerRecord(wallet, all, nowSec);
    if (wr.gigsCosigned === 0) {
      return (
        <Link to={`/lookup/${wallet}`} className="score-chip band-no-history">
          new to registry
        </Link>
      );
    }
    return (
      <Link
        to={`/lookup/${wallet}`}
        className="score-chip band-good"
        title="Open work record"
      >
        {wr.completedPaid} paid gig{wr.completedPaid === 1 ? "" : "s"} ·{" "}
        {formatCad(wr.earnedCents)} earned
      </Link>
    );
  }

  const hs = computeReputation(wallet, all, nowSec).claspScore;
  const cls = `score-chip band-${hs.band.toLowerCase().replace(" ", "-")}`;
  return (
    <Link to={`/lookup/${wallet}`} className={cls} title="Open payment history">
      {hs.score === null ? (
        "no payment history"
      ) : (
        <>
          <span className="pip" style={{ animation: "none", marginRight: "0.35rem" }} />
          {hs.score} · {hs.band}
        </>
      )}
    </Link>
  );
}

export function Board() {
  const { address, isConnected, chainId } = useAccount();
  const onMonad = chainId === monadTestnet.id;

  const { data, refetch } = useReadContract({
    address: BOARD_ADDRESS,
    abi: boardAbi,
    functionName: "getListings",
    args: [0n, 1_000_000n],
    query: { refetchInterval: 15_000 },
  });
  const listings = (data as readonly ListingData[] | undefined) ?? [];

  const [showForm, setShowForm] = useState(false);
  const [kind, setKind] = useState<0 | 1>(0);
  const [category, setCategory] = useState(0);
  const [title, setTitle] = useState("");
  const [details, setDetails] = useState("");
  const [link, setLink] = useState("");
  const [rate, setRate] = useState("");
  const [filterKind, setFilterKind] = useState<"all" | 0 | 1>("all");
  const [filterCat, setFilterCat] = useState<"all" | number>("all");
  const [formError, setFormError] = useState<string | null>(null);

  const { writeContract, data: txHash, isPending, error: writeError } =
    useWriteContract();
  const { isLoading: isConfirming, isSuccess: txLanded } =
    useWaitForTransactionReceipt({ hash: txHash });

  if (txLanded && showForm) {
    setShowForm(false);
    setTitle("");
    setDetails("");
    setLink("");
    setRate("");
    refetch();
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (!title.trim()) return setFormError("Give the listing a title.");
    if (new TextEncoder().encode(title).length > 80)
      return setFormError("Title is over 80 bytes.");
    if (new TextEncoder().encode(details).length > 400)
      return setFormError("Details are over 400 bytes — keep it brief, link out for more.");
    if (new TextEncoder().encode(link).length > 200)
      return setFormError("Link is over 200 bytes.");
    if (link.trim() && !/^https?:\/\//i.test(link.trim()))
      return setFormError("Link must start with http(s)://");
    const rateNum = rate.trim() === "" ? 0 : Number(rate);
    if (!Number.isFinite(rateNum) || rateNum < 0)
      return setFormError("Rate must be a number (or blank for negotiable).");

    writeContract({
      address: BOARD_ADDRESS,
      abi: boardAbi,
      functionName: "post",
      args: [
        kind,
        category,
        title.trim(),
        details.trim(),
        link.trim(),
        BigInt(Math.round(rateNum * 100)),
      ],
    });
  }

  const visible = listings
    .map((l, i) => ({ l, id: i }))
    .filter(({ l }) => l.active)
    .filter(({ l }) => filterKind === "all" || l.kind === filterKind)
    .filter(({ l }) => filterCat === "all" || l.category === filterCat)
    .reverse();

  return (
    <section>
      <h1>The board</h1>
      <p className="tagline">
        Work offered and work wanted — with the payment history built in.
        Every poster's wallet links straight to their Clasp Score, so you
        can check before you ever reach out.
      </p>

      <div className="hero-ctas">
        {!showForm && (
          <button className="connect-btn" onClick={() => setShowForm(true)}>
            Post a listing
          </button>
        )}
      </div>

      {showForm && (
        <form className="board-form" onSubmit={submit}>
          <label>
            I am…
            <select
              value={kind}
              onChange={(e) => setKind(Number(e.target.value) as 0 | 1)}
              className="board-select"
            >
              <option value={0}>Offering — services, goods, availability</option>
              <option value={1}>Seeking — hiring, buying, requesting</option>
            </select>
          </label>
          <label>
            Category
            <select
              value={category}
              onChange={(e) => setCategory(Number(e.target.value))}
              className="board-select"
            >
              {CATEGORY_LABELS.map((c, i) => (
                <option key={c} value={i}>{c}</option>
              ))}
            </select>
          </label>
          <label>
            Title
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={kind === 0 ? "Web design — 1-week turnaround" : "Need a logo by Friday"}
            />
          </label>
          <label>
            Details (optional, max 400 bytes — it goes onchain)
            <textarea
              rows={3}
              value={details}
              onChange={(e) => setDetails(e.target.value)}
            />
          </label>
          <label>
            Work link (optional — portfolio, screenshots of items, past work)
            <input
              value={link}
              onChange={(e) => setLink(e.target.value)}
              placeholder="https://…  (image links show as previews)"
              spellCheck={false}
            />
          </label>
          <label>
            Rate (CAD, optional)
            <input
              value={rate}
              onChange={(e) => setRate(e.target.value)}
              type="number"
              min="0"
              step="0.01"
              placeholder="blank = negotiable"
            />
          </label>
          {!isConnected && <p className="form-hint">Connect your wallet to post.</p>}
          {isConnected && !onMonad && (
            <p className="form-hint">Switch to Monad Testnet to post.</p>
          )}
          {formError && <p className="form-error">{formError}</p>}
          {writeError && (
            <p className="form-error">{writeError.message.split("\n")[0]}</p>
          )}
          <div className="hero-ctas" style={{ margin: 0 }}>
            <button
              type="submit"
              className="connect-btn"
              disabled={!isConnected || !onMonad || isPending || isConfirming}
            >
              {isPending
                ? "Confirm in wallet…"
                : isConfirming
                  ? "Posting onchain…"
                  : "Post listing"}
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setShowForm(false)}
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="board-filters">
        <select
          value={String(filterKind)}
          onChange={(e) =>
            setFilterKind(e.target.value === "all" ? "all" : (Number(e.target.value) as 0 | 1))
          }
        >
          <option value="all">Offering + seeking</option>
          <option value="0">Offering</option>
          <option value="1">Seeking</option>
        </select>
        <select
          value={String(filterCat)}
          onChange={(e) =>
            setFilterCat(e.target.value === "all" ? "all" : Number(e.target.value))
          }
        >
          <option value="all">All categories</option>
          {CATEGORY_LABELS.map((c, i) => (
            <option key={c} value={i}>{c}</option>
          ))}
        </select>
      </div>

      <div className="board-list">
        {visible.length === 0 && (
          <p className="field-note" style={{ textAlign: "center", maxWidth: "none" }}>
            No listings match. Clear the filters or post the first one.
          </p>
        )}
        {visible.map(({ l, id }) => (
          <article className="listing" key={id}>
            <div className="listing-head">
              <span className="listing-title">{l.title}</span>
              <span className="listing-cat">{CATEGORY_LABELS[l.category]}</span>
              <span
                className={`listing-kind ${l.kind === 0 ? "kind-offering" : "kind-hiring"}`}
              >
                {l.kind === 0 ? "Offering" : "Seeking"}
              </span>
            </div>
            {l.details && <p className="listing-details">{l.details}</p>}
            {l.link && (
              <div className="work-links">
                <LinkPreview url={l.link} />
              </div>
            )}
            <div className="listing-meta">
              <AddressChip
                address={l.poster}
                you={l.poster.toLowerCase() === address?.toLowerCase()}
              />
              <ScoreChip wallet={l.poster} kind={l.kind} />
              <span>{l.rateCents > 0n ? formatCad(l.rateCents) : "rate negotiable"}</span>
              <span>{formatTimestamp(l.postedAt)}</span>
            </div>
          </article>
        ))}
      </div>

      <p className="registry-stats">
        Listings live onchain in a separate contract — the registry itself
        stays a registry.
      </p>
    </section>
  );
}
