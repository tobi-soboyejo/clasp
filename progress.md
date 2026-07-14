# Progress

## Day 1 — 2026-07-13

- ✅ Foundry 1.7.1 installed (libusb workaround — see findings.md)
- ✅ Repo scaffolded: `contracts/` Foundry project, forge-std v1.16.2 submodule
- ✅ `HandshakeRegistry.sol` — full state machine (Proposed → Active → Paid /
  Defaulted → Disputed), 5 indexed events, custom errors, no aggregate
  counters onchain, no funds movement
- ✅ 24/24 Foundry tests passing (happy path, default+dispute, silent default,
  every guard revert, boundary conditions)
- ✅ Public repo live: https://github.com/tobi-soboyejo/handshake (first commit ~20:20 UTC, after the 13:00 UTC freshness cutoff)
- ⏳ Next: Day 2 — Monad testnet deploy + verify, then React/wagmi scaffold in `web/`

## Day 2 — 2026-07-13 (early start)

- ✅ Deployer wallet funded: 5 MON from official faucet
- ✅ `HandshakeRegistry` deployed to Monad testnet: `0xe5d9E4e899D0F04987de2E8f37e8FF7E9A2d2411`
- ✅ Source verified (Sourcify exact match); live view calls sanity-checked
- ⏳ Next: scaffold React + Vite + wagmi in `web/`, wallet connect on chain 10143
- ✅ `web/` scaffolded: React + Vite + TS, wagmi/viem wired to chain 10143,
  wallet connect with wrong-network prompt, live `agreementCount()` read from
  the deployed contract rendering in-browser (verified, no console errors)

## Day 3 — 2026-07-13 (early start)

- ✅ Screen 1 (New Agreement): full form, client-side keccak256 of scope,
  createAgreement write flow, shareable co-sign link + copy button
- ✅ Screen 2 (Agreement Detail): terms, status badge, context-aware actions
  (co-sign / confirm paid / flag default / dispute with reason), scope-text
  fingerprint verification, state-derived onchain timeline
- ✅ Contract v1.1: lifecycle timestamps in state + getAgreements batch view
  (works around Monad RPC's 100-block getLogs cap — no indexer, no API keys);
  redeployed + verified; 25/25 tests
- ✅ Agreement #0 re-seeded with real txs (scripts/seed.sh); detail screen
  verified rendering live chain data in browser
- ⏳ Next: cosign/confirm click-through with MetaMask (needs Tobi), then
  Day 4: lookup screen + transparent grade

## Day 4 — 2026-07-13 (early start)

- ✅ Agreement #0 concluded (confirmPaid from CLIENT1) — first real Paid outcome
- ✅ Screen 3 (Lookup): reputation card with transparent grade (formula in
  README + printed in UI), paid/silent/disputed counts, pending-window bucket,
  CAD volume both roles, first-seen + history depth, color-coded table
- ✅ Human-friendly wallets: local nicknames (petnames), identicon dots,
  jargon pass ("gets paid / pays", "account number" framing)
- ✅ Verified in browser: CLIENT1 lookup shows A (provisional), 100% math,
  $3,650 volume, Paid + Active rows — all from getAgreements state reads
- ⏳ Feature freeze pending roadmap tie-in decision

## Day 5 — 2026-07-13/14 (early start)

- ✅ Handshake Score v1.5 live: 300–850, size/recency/diversity factors,
  recovery streak, full per-agreement breakdown table on the card
- ✅ Defaults score immediately (decision logged in findings)
- ✅ Seeded full demo dataset: 8 agreements, 4 wallets, every outcome type,
  all real txs — bad client scores 419 (Bad), good client 777 (Excellent)
- ✅ Design pass: Fraunces ledger serif, footer, favicon, hover states,
  mobile verified at 375px
- ⏳ Remaining Day 5: deploy to Vercel (needs Tobi's login), rehab streak
  will display once a mixed history exists post-dispute-window
