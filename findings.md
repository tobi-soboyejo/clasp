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
