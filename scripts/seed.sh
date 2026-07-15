#!/usr/bin/env bash
# Seed demo agreements on the deployed ClaspRegistry with REAL testnet
# transactions (the judging agent penalizes hardcoded data — everything the
# app shows must come from the chain).
#
# Usage: scripts/seed.sh <registry-address>
# Needs contracts/.env with PRIVATE_KEY (deployer/freelancer), CLIENT1_PK,
# CLIENT1_ADDR, RPC_URL.
set -euo pipefail

# macOS SIP strips DYLD_* env vars when exec-ing a protected shell, so
# re-assert the libusb fallback Foundry needs on Macs without Homebrew.
export PATH="$HOME/.foundry/bin:$PATH"
export DYLD_FALLBACK_LIBRARY_PATH="${DYLD_FALLBACK_LIBRARY_PATH:-$HOME/.local/lib}"

REGISTRY="${1:?usage: scripts/seed.sh <registry-address>}"
cd "$(dirname "$0")/../contracts"
set -a; source .env; set +a

send() { # send <private-key> <sig> [args...]
  local pk="$1"; shift
  cast send "$REGISTRY" "$@" --private-key "$pk" --rpc-url "$RPC_URL" --json |
    python3 -c 'import json,sys; r=json.load(sys.stdin); print(r["status"], r["transactionHash"])'
}

now() { date +%s; }

echo "== Agreement #0: website gig, co-signed, active (will be confirmed paid in demo)"
SCOPE_0='Redesign and relaunch the 5-page marketing site for a solar installation company: new copy, mobile layouts, contact-form wiring, and deployment to the client host. Payment of $1,850 CAD by e-transfer within 3 days of delivery.'
send "$PRIVATE_KEY" "createAgreement(address,uint256,uint64,bytes32)" \
  "$CLIENT1_ADDR" 185000 "$(($(now) + 5 * 24 * 3600))" "$(cast keccak "$SCOPE_0")"
send "$CLIENT1_PK" "cosign(uint256)" 0

echo "== Done. agreementCount:"
cast call "$REGISTRY" "agreementCount()(uint256)" --rpc-url "$RPC_URL"
echo
echo "Scope texts are NOT onchain (only hashes). To render them in a browser,"
echo "paste into localStorage, e.g.:  localStorage.setItem('clasp:scope:0', <text>)"
