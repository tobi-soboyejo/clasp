<img src="web/public/logo.svg" width="110" alt="Handshake logo" />

# Clasp

**A payment-reputation registry for informal gig work, on Monad testnet.**

A client owed me $2,000 for completed work and vanished — I'm pursuing it
legally. There was no way to check his payment history before taking the job,
and there's no way for the next freelancer to learn from what happened to me.
Informal work has no credit bureau: payment behavior lives in private inboxes
and dies there. Clasp is the credit check I wish I'd run.

## How it works

Before a gig starts, freelancer and client **co-sign the agreement onchain**
(scope hash, amount, deadline). After the deadline:

- Client confirms payment → builds their good reputation ✅
- Client doesn't pay → freelancer flags a default; the client gets a 14-day
  window to dispute 🔴
- Client stays silent → the silence itself is recorded — a **silent default**,
  the worst mark 🔇

The registry never rules on who's right. It publishes behavior on mutually
signed commitments, and anyone can look up a wallet before working with them.

**The client never needs to own crypto.** Co-signing works gaslessly: the
client signs a free EIP-712 typed message in their wallet — like DocuSign —
and the freelancer submits it onchain (`cosignBySig`), paying the fee.

**This is a registry, not an escrow.** No funds ever move through the
contract — real-world payments are fiat (e-transfer etc.). The chain records
*commitments and outcomes*, not money.

**Why onchain?** Any centralized "clients who don't pay" database gets sued or
pressured into deleting records — the worst actors are the most litigious. A
permissionless contract has no one to send the cease-and-desist to. And no
false entries are possible: nobody appears in the registry without their own
cryptographic signature on the original agreement.

## Structure

```
contracts/   Foundry project — ClaspRegistry.sol + tests
web/         React + Vite + wagmi frontend (coming)
```

## Contract

One contract, deliberately minimal: [`ClaspRegistry.sol`](contracts/src/ClaspRegistry.sol)

State machine per agreement:

```
PROPOSED ──cosign()──▶ ACTIVE ──confirmPaid()──▶ PAID (terminal, good mark)
    │                    │
    │ never cosigned:    └─ after deadline: flagDefault() ──▶ DEFAULTED
    ▼ expires silently                                          │
 (expired)                          dispute() within 14 days ──▶ DISPUTED (terminal)
                                    window passes silently  ──▶ stays DEFAULTED
                                                                 ("silent default", terminal)
```

Reputation is computed **off-chain from events** — the contract stores no
aggregate counters.

### Deployment (Monad testnet)

| | |
|---|---|
| Contract | [`0xac644Cc4967d9e3735c2dA3D8c8C881637B3A43f`](https://testnet.monadvision.com/address/0xac644Cc4967d9e3735c2dA3D8c8C881637B3A43f) |
| Chain ID | 10143 |
| RPC | `https://testnet-rpc.monad.xyz` |
| Deploy tx | `(see explorer — ClaspRegistry creation tx)` |
| Source verified | Sourcify (exact match) — readable on the explorer |

Design note: Monad's public RPC caps `eth_getLogs` at a 100-block range, so
the app never scans logs. The contract stores every lifecycle timestamp in
its state and exposes a batch getter (`getAgreements`) — the whole UI,
including reputation, is derived from plain `eth_call` reads. Events are
still emitted for anyone who wants to index later.

## Run the tests

```bash
git clone --recursive <this-repo>
cd handshake/contracts
forge test -vv
```

24 tests cover the happy path, default + dispute, silent default, and every
guard revert (wrong caller, wrong status, pre-deadline flag, expired dispute
window, boundary conditions).

## Known limitations (honest ones)

1. **Sybil / fresh wallets** — a burned client can rotate to a new wallet.
   v1 mitigation: lookup surfaces wallet age and history depth, so blankness
   is itself a red flag (like a business with no credit history). Roadmap:
   identity attestations, client activation stakes.
2. **Scope text is off-chain** — only the keccak256 hash is onchain; v1 keeps
   the full text in localStorage. Roadmap: IPFS.
3. **Cold start** — a registry's value grows with network size. Roadmap: embed
   as a reputation layer inside existing freelance platforms.

## The Clasp Score is not a black box

The lookup screen shows a 300–850 score computed client-side from public
onchain state, with every input printed on the card. On a public chain an
opaque score would be a pretense — anyone can recompute anything — so
transparency is the product. The data is the permanent record; the score is
a published, contestable lens over it. Disagree with the weights? Fork the
lens; the record stays.

```
per concluded agreement (as the paying party):
  credit      paid = 1 · disputed = 0.4 · defaulted = 0
  punctuality paid by deadline ×1.0 · ≤7 days late ×0.85 · later ×0.7
  weight      defaults ×2 (disputing restores partial credit via 0.4)
  size        amount/$500, clamped [0.25, 3] — tiny gigs can't pad a record
  decay       ½^(age/halfLife); halfLife = base × (0.5 + size/2), clamped
              [0.5y, 3y]; base 1y paid · 1.5y disputed · 2y defaulted.
              Asymmetric and size-scaled: good marks fade in about a year,
              a big default lingers up to three. Rehab is arithmetic.

pct       = Σ(credit·punctuality·size·decay) / Σ(weight·size·decay)
diversity = 0.6 + 0.4 × (unique counterparties ÷ concluded)  — 10 deals with
            10 people ≠ 10 deals with 1 (anti wash-trading)
exposure  = open co-signed volume ÷ lifetime paid volume; each unit above
            2× costs 20 pts, capped at −40 (credit-utilization analog)
score     = clamp(300 + pct × diversity × 550 − exposure, 300, 850)
            750+ Excellent · 650+ Good · 550+ Fair · 450+ Poor · below Bad
```

Each factor exists to kill a specific attack, and each limitation is stated:
the score can't stop a patient Sybil ring, can't measure work quality, and
only scores what was signed. Defaults count the moment they're flagged (the
registry warns the *next* person now; a dispute restores partial credit the
moment it lands). Under three concluded outcomes the score is provisional.
No history shows "—", deliberately framed as *unknown, not bad*. When a
wallet with old bad marks builds a paid streak, the card says so — recency
decay makes rehabilitation a property of the math, not a promise.

## Beyond gig work

The primitive is **any co-signed promise to pay with a public outcome**, and
it works today for more than freelance jobs. **Virtual-asset deals** — game
accounts, items, boosting services — are gray markets full of pseudonymous
strangers with zero recourse, and they map straight onto the registry
(seller = payee, buyer = payer, scope describes the asset; a non-delivery
disagreement surfaces through the dispute mechanic with both claims visible).
Chinese courts recognizing game accounts as inheritable private property
underlines that these assets are real economic property with real markets.

## Roadmap

Rent is the next binding — rent history is the classic "invisible credit"
problem, and every kept promise in this registry is credit rehabilitation
for someone the bureaus can't see. The accountability direction matters:
tenant-facing landlord history first, not landlord-facing tenant scores —
punching up, not down. Also ahead: symmetric outcome flags (either party can
flag non-performance — completes the virtual-asset story), a transparent
scoring model (v1 deliberately publishes raw outcomes and shows its
arithmetic), identity attestations and vouching for newcomers, and embedding
as a reputation layer inside field-service and freelance platforms where
these clients already live.

---

Built for the [Spark hackathon](https://buildanything.so/hackathons/spark) (Monad testnet track), July 2026.
