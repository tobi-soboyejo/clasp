<img src="web/public/logo.svg" width="110" alt="Clasp logo" />

# Clasp — the credit check for deals between strangers

**Live: [claspscore.com](https://claspscore.com) · Monad Testnet (chain 10143)**

A client owed me $2,000 for completed work and vanished — I'm pursuing it
legally. There was no way to check his payment history before taking the job,
and there's no way for the next freelancer to learn from what happened to me.
Informal work has no credit bureau: payment behavior lives in private inboxes
and dies there. Clasp is the credit check I wish I'd run.

Gig work is the wedge, not the boundary — the primitive is **any co-signed
promise to pay with a public outcome**: freelance jobs, game-account sales,
trades, rent.

## How it works

Before the deal starts, both parties **co-sign the agreement onchain**
(scope fingerprint, amount, deadline). Then:

- Payer confirms payment → builds their good history
- Payer doesn't pay → the other side flags a default; the payer gets a
  14-day window to dispute
- Payer stays silent → the silence itself is recorded — a **silent
  default**, the worst mark

The registry never rules on who's right. It publishes behavior on mutually
signed commitments, and anyone can look up a wallet before working with them.

**The client never needs to own crypto.** Co-signing works gaslessly: the
client signs a free EIP-712 typed message in their wallet — like DocuSign —
and the freelancer submits it onchain (`cosignBySig`), paying the fee.

**This is a registry, not an escrow.** No funds ever move through the
contracts — real-world payments are fiat (e-transfer etc.). The chain records
*commitments and outcomes*, not money.

**Why onchain?** Any centralized "clients who don't pay" database gets sued
or pressured into deleting records — the worst actors are the most
litigious. A permissionless contract has no one to send the cease-and-desist
to. And no false entries are possible: nobody appears in the registry
without their own cryptographic signature on the original agreement.

## The contracts (all Sourcify-verified on Monad testnet)

| Contract | Address | Purpose |
|---|---|---|
| [`ClaspRegistry`](contracts/src/ClaspRegistry.sol) | [`0xac644Cc4967d9e3735c2dA3D8c8C881637B3A43f`](https://testnet.monadvision.com/address/0xac644Cc4967d9e3735c2dA3D8c8C881637B3A43f) | Co-signed agreements + outcomes (the record) |
| [`ClaspBoard`](contracts/src/ClaspBoard.sol) | [`0x432a33034C9ccabD73c17C08B9237a2aC6C81Ae9`](https://testnet.monadvision.com/address/0x432a33034C9ccabD73c17C08B9237a2aC6C81Ae9) | Listings board — every poster wears their score |
| [`ClaspProfile`](contracts/src/ClaspProfile.sol) | [`0x3A853A7Ed366C545c2f37928CA6e08dcBE694e69`](https://testnet.monadvision.com/address/0x3A853A7Ed366C545c2f37928CA6e08dcBE694e69) | Self-declared display names (never replace the address) |

State machine per agreement:

```
PROPOSED ──cosign() / cosignBySig()──▶ ACTIVE ──confirmPaid()──▶ PAID (terminal, good mark)
    │                                    │
    │ never co-signed:                   └─ after deadline: flagDefault() ──▶ DEFAULTED
    ▼ expires silently                                                          │
 (expired, counts for nothing)                  dispute() within 14 days ──▶ DISPUTED (terminal)
                                                window passes silently   ──▶ stays DEFAULTED
                                                                              ("silent default")
```

**Gasless co-sign:** `cosignBySig(id, signature)` verifies an EIP-712
signature over `Cosign(agreementId, client)`. Replay-safe without nonces — a
signature only works while the agreement is Proposed and is domain-bound to
this chain and contract. Signature malleability (EIP-2) rejected.

**Identity by annotation, not replacement:** display names are deliberately
non-unique — squatting "Lakeshore Solar" gains nothing because the address
and its record are the identity; the name is a human handle, always shown
beside the address. Your own local petnames (browser-only) override anything
a wallet claims about itself.

**Design note — no indexer, no API keys:** Monad's public RPC caps
`eth_getLogs` at a 100-block range, so the app never scans logs. The
contracts store every lifecycle timestamp in state and expose batch getters;
the whole UI, including reputation, derives from plain `eth_call` reads.
Events are still emitted for anyone who wants to index later.

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
wallet with old bad marks builds a paid streak, the card says so — decay
makes rehabilitation a property of the math, not a promise.

Vetting the *paid* side instead (freelancer, seller, sub-contractor,
landlord)? The lookup's track-record lens shows delivered-and-paid
engagements, earnings, contested outcomes, current load, and repeat
counterparties — the one signal money can't fake cheaply.

## Run it yourself (≈3 minutes)

```bash
git clone --recursive https://github.com/tobi-soboyejo/clasp
cd clasp/contracts && forge test -vv        # 43 tests, 3 suites
cd ../web && npm install && npm run dev      # http://localhost:5173
```

No API keys, no indexer, no backend — the app talks straight to Monad's
public RPC. Every number you see anywhere in the app is a live chain read;
the demo data was created with real testnet transactions
(`scripts/seed.sh`, `scripts/seed-day5.sh` — outcomes staged with short
real deadlines, not mocks).

## Known limitations (honest ones)

1. **Sybil / fresh wallets** — a burned client can rotate to a new wallet.
   v1 mitigation: lookup surfaces wallet age and history depth, so blankness
   is itself a red flag (like a business with no credit history) — and if
   someone refuses to co-sign at all, that's your answer too.
2. **Agreement text is off-chain** — only the keccak256 fingerprint is
   onchain; v1 keeps full text in localStorage, and the UI verifies any
   pasted text against the fingerprint. Roadmap: IPFS.
3. **Cold start** — a registry's value grows with network size. Roadmap:
   embed as a reputation layer inside existing freelance and field-service
   platforms.
4. **Scores measure payment, not quality** — a payer confirming is a payer
   who accepted the work, and rehires are strong signal, but Clasp does not
   pretend to referee craftsmanship.

## Roadmap

- **ZK selective disclosure** — prove "my score is above 700" without
  revealing the underlying history (the privacy answer for a public
  registry).
- **Attestation composability** — publish outcomes via EAS-style
  attestations so other apps can build on them (lending against reputation).
- **Rent as the next vertical** — rent history is the classic "invisible
  credit" problem; landlord-accountability first (punching up, not down).
- **Symmetric outcome flags** — either party flags non-performance;
  completes the virtual-asset story.
- **Client activation stakes**, identity attestations, and vouching for
  newcomers.

---

Built solo (with Claude) in four days for the Spark hackathon
(BuildAnything × Monad), July 2026.
