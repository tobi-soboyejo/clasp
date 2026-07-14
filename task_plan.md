# Handshake — Task Plan

Hackathon: Spark (BuildAnything / Monad) — deadline **July 19, 2026, 11:59 PM UTC**.
Full requirements live in the project brief; this file tracks execution.

## Day 1 (Jul 13–14) — Contract

- [x] Fresh repo init (first commit after Jul 13 1:00 PM UTC ✓ — started ~20:00 UTC)
- [x] Foundry toolchain installed (see findings.md for libusb workaround)
- [x] `HandshakeRegistry.sol` written to spec
- [x] Full test suite: happy path, default+dispute, silent default, all guard reverts (24 tests)
- [x] Public GitHub repo created and pushed — https://github.com/tobi-soboyejo/handshake

## Day 2 (Jul 14–15) — Deploy + frontend scaffold

- [x] Read Monad deploy/verify guides (used docs directly; Monskills not needed)
- [x] Fund deployer wallet from Monad testnet faucet (5 MON via official faucet, Discord tier)
- [x] Deploy `HandshakeRegistry` to Monad testnet — `0xe5d9E4e899D0F04987de2E8f37e8FF7E9A2d2411`
- [x] Verify contract — Sourcify exact match via sourcify-api-monad.blockvision.org
- [x] Scaffold React + Vite + wagmi + viem in `web/`; live chain read rendering in-browser (wallet-connect click-test with MetaMask pending — needs Tobi's browser)

## Day 3 (Jul 15–16) — Screens 1 & 2

- [ ] Screen 1: New Agreement form (client addr, CAD amount, deadline, scope textarea; keccak256 scope client-side; localStorage for scope text; shareable `/agreement/:id` link)
- [ ] Screen 2: Agreement detail — status badge, context-aware action button per role/status, event timeline with explorer links
- [ ] End-to-end against the deployed contract with two test wallets

## Day 4 (Jul 16–17) — Screen 3 + FEATURE FREEZE

- [ ] Screen 3: wallet lookup — reputation card (gigs, paid/defaulted/disputed, CAD volume, first-seen date + history depth), color-coded agreements table
- [ ] Transparent grade on the reputation card: letter grade from a PUBLISHED formula, arithmetic shown under it (silent defaults weigh heaviest; shallow history discounts). No opaque scoring — v1 is deliberately auditable.
- [ ] Events via viem `getLogs` — no indexer, no hardcoded data anywhere
- [ ] **Feature freeze end of day**

## Day 5 (Jul 17–18) — Polish + deploy + seed

- [ ] Design polish pass (deliberate direction — credit-bureau-meets-handshake; not AI slop)
- [ ] Mobile responsive; everything fits in viewport
- [ ] Deploy frontend to Vercel, live public URL
- [ ] Seed demo data with REAL testnet txs from 2–3 wallets: paid, silent default, disputed outcomes; one short-deadline agreement for the live demo; include one game-account-sale agreement (digital-deals use case)

## Day 6 (Jul 18–19) — Ship

- [ ] README final: setup in ≤3 min, registry-not-escrow explicit, honest limitations (Sybil/fresh wallets, scope off-chain, cold start)
- [ ] 3-min demo video per script in brief §9
- [ ] Social post (viral track)
- [ ] Submit: name, write-ups, live URL, repo, **Monad Testnet** category, contract address, video URL, social URL

## Standing rules

- Every displayed number comes from the chain — no placeholder data, no fake buttons.
- Log every error in findings.md; never repeat a failed action unchanged.
- Meaningful commit messages.
