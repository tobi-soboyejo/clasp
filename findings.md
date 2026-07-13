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
