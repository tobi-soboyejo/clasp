# Findings & Decisions Log

## 2026-07-13 — Day 1

### Environment
- **Foundry install hit a libusb wall on this Mac** (no Homebrew): every Foundry
  binary links `/usr/local/opt/libusb/lib/libusb-1.0.0.dylib`. Fix: built libusb
  1.0.27 from the official source release into `~/.local`, and exported
  `DYLD_FALLBACK_LIBRARY_PATH="$HOME/.local/lib"` (persisted in `~/.zshenv`).
  Foundry 1.7.1 (forge/cast/anvil) all working.
- Timing check: first commit lands ~20:00 UTC Jul 13 — safely after the
  1:00 PM UTC freshness cutoff.

### Contract decisions (deviations/clarifications vs. brief)
- **`cosign()` also requires `block.timestamp <= deadline`** (`ProposalExpired`).
  The brief's guard table only lists `status == Proposed`, but its state diagram
  says un-cosigned proposals expire. Without this guard a client could co-sign a
  stale proposal and be flagged as defaulted in the same block. Implements the
  diagram's intent.
- **`resolvedAt` doubles as the default-flag timestamp** — `dispute()` checks
  `now <= resolvedAt + DISPUTE_WINDOW` and does NOT overwrite `resolvedAt`, so
  the original flag time stays on record alongside `disputeHash`.
- **Dispute window boundary is inclusive** (`now <= flaggedAt + 14 days` allowed).
- **`flagDefault` boundary is strict** (`now > deadline`) per brief.
- Added `ClientIsZero` guard (not in brief) — a zero-address client could never
  co-sign, would just be junk rows.
- Custom errors throughout (cheaper + machine-readable for the frontend).
- Agreements stored in an array; ids are sequential indices — makes Screen 3's
  `getLogs`/enumeration trivial.
- Pinned solc in `foundry.toml` so testnet verification (Day 2) matches exactly.

### Repo structure
- Single git repo at root; `contracts/` is a Foundry project (forge-std as a
  proper submodule pinned to v1.16.2 — judges can `git clone --recursive`),
  `web/` comes Day 2.

## 2026-07-13 — Day 2 (started same day, ahead of schedule)

### Deployment
- Deployer (throwaway, testnet-only): `0x195897846C31a77D913d658160cBfea4eC9a2009`,
  key in `contracts/.env` (gitignored, chmod 600).
- Faucets: QuickNode and Alchemy both REJECT fresh wallets (require ≥0.001 ETH
  on Ethereum mainnet as anti-abuse). Official faucet via testnet.monad.xyz
  paid the full 5 MON Discord tier. Plenty for deploy + Day 5 seeding.
- Deployed `HandshakeRegistry` → `0xe5d9E4e899D0F04987de2E8f37e8FF7E9A2d2411`
  (tx `0x4b6eaedc0469c889375231f6223f2c42f84ca25940bcf0fa626a66c1dd935470`).
- Sanity-checked live: `agreementCount()` = 0, `DISPUTE_WINDOW()` = 1209600 (14 days).
- Verified via Sourcify (`--verifier sourcify --verifier-url
  https://sourcify-api-monad.blockvision.org/`) — **exact_match**.
- Network: chain ID 10143, RPC https://testnet-rpc.monad.xyz (also
  rpc.testnet.monad.xyz per dev portal), explorers testnet.monadvision.com /
  testnet.monadscan.com.

## 2026-07-13 — Day 3 (early start)

### The getLogs wall → state-derived architecture (KEY DECISION)
- Monad public RPC (and thirdweb's) limit `eth_getLogs` to a **100-block
  range**; Ankr rejects large ranges too; dRPC free tier caps at 10k blocks
  (~83 min of Monad blocks); Envio HyperRPC now requires an API token.
  Event-scan-based reputation would need hundreds of chunked requests or a
  third-party API key — both bad for judges cloning the repo.
- Fix: contract v1.1 stores ALL lifecycle timestamps in the struct
  (`createdAt`, `disputedAt` added) and exposes `getAgreements(from,to)`
  batch view. Entire UI (timeline, reputation) derives from `eth_call` state
  reads. Events still emitted for future indexers. 25 tests pass.
- Redeployed + verified (Sourcify exact_match):
  `0xbefa778FDb69FCD1F851801a5D5e8b8191C7929c`, deploy block 44691765,
  tx `0x2f9ffadefb1dcb173148a0b691e28f65d6d3f68bfa7d7753d0107216aa3bae7b`.
  Old address 0xe5d9…2411 abandoned (was pre-seed; only test data lost).
- Timeline explorer links: per-action tx hashes recorded to localStorage at
  write time (real hashes, no scanning); timestamps always shown from state.

### Test data (real txs via scripts/seed.sh)
- Test client wallet CLIENT1 `0x85D1927b2BBf1bB4C1b4D53ad011D83780c9C60b`
  (key in contracts/.env), funded 0.5 MON from deployer.
- Agreement #0 on v1.1: $1,850 CAD website gig, deadline Jul 18, created by
  deployer (freelancer), co-signed by CLIENT1 → Active. Scope text recorded
  in seed.sh (only its keccak hash is onchain).

### Gotcha log
- macOS SIP strips DYLD_* env vars when exec-ing shell scripts → seed.sh
  exports DYLD_FALLBACK_LIBRARY_PATH itself.
- npm cache ~/.npm partially root-owned (old sudo npm) → use --cache override
  or fix ownership later.

### Scope adjustments agreed with Tobi
- Day 4 adds a TRANSPARENT grade to the lookup card (published formula,
  arithmetic shown). No opaque scoring in v1.
- README roadmap now frames the primitive as "any co-signed promise to pay"
  (rent next, landlord-accountability-first, rehabilitation framing).

## 2026-07-13 — scope decision: Handshake Score v1.5 (Tobi + Claude)

- Upgrade lookup grade → "Handshake Score": FICO-style 300–850, glass-box.
  New factors, each anti-gaming: deal-size weighting (kills tiny-gig padding),
  recency decay ~1yr half-life (implements rehabilitation mechanically,
  absorbs the trend indicator), counterparty diversity (kills wash-trading
  between own wallets). Provisional + window-open rules carry over. Full
  breakdown printed on the card; formula in README. No ML, no opaque weights.
- Build on Day 5 with seeding (needs varied/aged histories to verify).
- Contract frozen at v1.1. Symmetric flags stay v2 (would split the grade's
  meaning mid-demo).
- Prepr bridge noted (Tobi): data-dividend payouts are recurring promises to
  pay — publishing a payout record against co-signed commitments could be a
  Prepr trust signal someday. Pattern kinship: glass-box scoring ↔ Prepr's
  consent-first/member-owned data stance. Log to Prepr vault NOTES-FOR-LATER
  in a Prepr session; no code bridge now.

## 2026-07-13 — Day 5 decision: defaults score immediately

- Reversal of the Day-4 "window-open defaults ungraded" rule. Reasons:
  (1) product: the registry exists to warn the NEXT counterparty now, not
  after a 14-day grace; the client's remedy is dispute, which restores
  partial credit instantly. Mirrors real credit reporting.
  (2) practical: testnet time can't be warped — a default flagged this week
  is inside its window until after the submission deadline, so the old rule
  made the demo's red mark invisible to the score on judging day.
- UI still distinguishes "default — dispute window open until <date>" from
  "silent default" (window lapsed). Same score weight; different label.

### Deploy (Day 5 close)
- Vercel account verified personal (`tobi-vercel-personal`, team
  websitetobi-8765s-projects — no Lodestar team in this login).
- Project `handshake`, prod URL https://handshake-wine.vercel.app.
  vercel.json rewrites all paths to index.html so shareable
  /agreement/:id and /lookup/:address links work.
- Demo wallets recap: CLIENT2 (bad) 0x506e27e3056df5d75810c753999af2A71F791D5d
  scores 419; CLIENT1 (good) 0x85D1927b2BBf1bB4C1b4D53ad011D83780c9C60b
  scores 777; FREEL2 0x568cBFAF15045Af08946fC65E62f5A6bC2Af64E1.

## 2026-07-14 — Tobi's design/product feedback round (6 items)

1. Landing page added at / (hero, live stat strip, 3 steps, CTAs);
   New Agreement moved to /new.
2. Wallet-connect rejection no longer shows an error (closing the popup
   isn't an error); real failures get a cleaned-up message.
3. Display type switched Fraunces → Archivo 800/900 (Helvetica-school
   grotesk; real Helvetica isn't web-licensed). One family + mono now.
4. Layout centered: headings, taglines, forms as blocks; tables stay
   left-aligned inside the centered column for readability.
5. THE BOARD: new page + second contract `HandshakeBoard.sol`
   (0x11a0969953cEc24cBfF36CCa94B0dBD9Da7e6827, Sourcify-verified, 7 tests).
   Listings (title/details/rate) live onchain — no backend allowed and
   hashes can't cross browsers. Killer detail: every listing shows the
   poster's Handshake Score chip inline (bad client's "Hiring" listing
   wears its 419). Registry contract untouched — still frozen at v1.1.
   3 listings seeded with real txs.
6. Removed the banknote-edge yellow strip.

## 2026-07-14 — feedback round 2 (Tobi)

- Emoji stat markers → bordered "pips" (colored outline squares, soft pulse,
  reduced-motion safe). Emoji in UI = slop signal, agreed.
- Score stamp → dark slab with breathing ambient glow in band color
  (Vercel-button reference). Count-up kept.
- Type system → Geist + Geist Mono (Vercel). Wordmark/headers/body one family.
- Vetting lens (Jobber story): computeWorkerRecord() — gigs delivered+paid,
  earned, contested, active load, REHIRE RATE (same client co-signing again =
  the unfakeable quality signal), defaults-suffered attributed to the client
  not the worker. Card on lookup; board chips now role-aware (hiring →
  payer score, offering work → delivery record).
- Score v2 discussion pending (punctuality, exposure, etc.) — proposal sent.
