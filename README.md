# Handshake 🤝

**A payment-reputation registry for informal gig work, on Monad testnet.**

A client owed me $2,000 for completed work and vanished — I'm pursuing it
legally. There was no way to check his payment history before taking the job,
and there's no way for the next freelancer to learn from what happened to me.
Informal work has no credit bureau: payment behavior lives in private inboxes
and dies there. Handshake is the credit check I wish I'd run.

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
contracts/   Foundry project — HandshakeRegistry.sol + tests
web/         React + Vite + wagmi frontend (coming)
```

## Contract

One contract, deliberately minimal: [`HandshakeRegistry.sol`](contracts/src/HandshakeRegistry.sol)

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
| Contract | [`0xbefa778FDb69FCD1F851801a5D5e8b8191C7929c`](https://testnet.monadvision.com/address/0xbefa778FDb69FCD1F851801a5D5e8b8191C7929c) |
| Chain ID | 10143 |
| RPC | `https://testnet-rpc.monad.xyz` |
| Deploy tx | `0x2f9ffadefb1dcb173148a0b691e28f65d6d3f68bfa7d7753d0107216aa3bae7b` |
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
