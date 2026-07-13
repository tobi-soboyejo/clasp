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
