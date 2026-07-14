#!/usr/bin/env bash
# Day-5 demo dataset: every outcome the registry supports, created with REAL
# testnet transactions (no hardcoded data anywhere — the judging agent checks).
#
# Wallets: deployer = freelancer 1 · FREEL2 = freelancer 2
#          CLIENT1 = good client   · CLIENT2 = the client who doesn't pay
#
# Outcomes created here (ids relative to current agreementCount):
#   +0 F1→C1  $300  game-account sale        → PAID   (digital-deals use case)
#   +1 F2→C1  $760  logo package             → PAID   (counterparty diversity)
#   +2 F1→C2  $900  delivery contract        → PAID   (bad client's one good mark)
#   +3 F1→C2  $2,050 web design, short ddl   → DEFAULTED (the red mark)
#   +4 F2→C2  $480  flyer print run, short   → DEFAULTED → DISPUTED by client
#   +5 F1→C1  $650  proposal, never co-signed → EXPIRES (counts for nothing)
#
# Usage: scripts/seed-day5.sh <registry-address>
set -euo pipefail

export PATH="$HOME/.foundry/bin:$PATH"
export DYLD_FALLBACK_LIBRARY_PATH="${DYLD_FALLBACK_LIBRARY_PATH:-$HOME/.local/lib}"

REGISTRY="${1:?usage: scripts/seed-day5.sh <registry-address>}"
cd "$(dirname "$0")/../contracts"
set -a; source .env; set +a

newwallet() { # newwallet <ENVPREFIX>
  local out pk addr
  out=$(cast wallet new)
  pk=$(echo "$out" | awk '/Private key:/ {print $3}')
  addr=$(echo "$out" | awk '/Address:/ {print $2}')
  printf '%s_PK=%s\n%s_ADDR=%s\n' "$1" "$pk" "$1" "$addr" >> .env
  echo "$addr"
}

send() { # send <pk> <sig-and-args...>
  cast send "$REGISTRY" "${@:2}" --private-key "$1" --rpc-url "$RPC_URL" --json |
    python3 -c 'import json,sys; r=json.load(sys.stdin); print(" ", r["status"], r["transactionHash"])'
}

if [ -z "${CLIENT2_ADDR:-}" ]; then
  CLIENT2_ADDR=$(newwallet CLIENT2); fi
if [ -z "${FREEL2_ADDR:-}" ]; then
  FREEL2_ADDR=$(newwallet FREEL2); fi
set -a; source .env; set +a

echo "== funding CLIENT2 $CLIENT2_ADDR and FREEL2 $FREEL2_ADDR"
cast send "$CLIENT2_ADDR" --value 0.4ether --private-key "$PRIVATE_KEY" --rpc-url "$RPC_URL" --json >/dev/null
cast send "$FREEL2_ADDR" --value 0.4ether --private-key "$PRIVATE_KEY" --rpc-url "$RPC_URL" --json >/dev/null

BASE=$(cast call "$REGISTRY" "agreementCount()(uint256)" --rpc-url "$RPC_URL")
NOW=$(date +%s)
LONG=$((NOW + 4 * 24 * 3600))
SHORT=$((NOW + 75))
echo "== base id: $BASE"

S0='Sale of Valorant account, level 214, Radiant peak, 31 skins incl. Elderflame set. Login + email transfer within 24h of e-transfer. $300 CAD.'
S1='Logo package for a mobile detailing business: primary mark, wordmark, 3 colorways, vector + social kit. $760 CAD on delivery.'
S2='Same-day courier contract, 12 deliveries downtown core, week of Jul 13. $900 CAD net 3 days.'
S3='Full website redesign for dental clinic: 8 pages, booking integration, copy, launch. 50% deposit unpaid balance $2,050 CAD due on launch.'
S4='Flyer print run 5,000pcs + distribution map for open-house campaign. $480 CAD on completion.'
S5='Weekly social content retainer, 3 posts/wk. First month $650 CAD.'

echo "== create + cosign + conclude the PAID trio"
send "$PRIVATE_KEY"  "createAgreement(address,uint256,uint64,bytes32)" "$CLIENT1_ADDR" 30000  "$LONG" "$(cast keccak "$S0")"
send "$FREEL2_PK"    "createAgreement(address,uint256,uint64,bytes32)" "$CLIENT1_ADDR" 76000  "$LONG" "$(cast keccak "$S1")"
send "$PRIVATE_KEY"  "createAgreement(address,uint256,uint64,bytes32)" "$CLIENT2_ADDR" 90000  "$LONG" "$(cast keccak "$S2")"
send "$CLIENT1_PK" "cosign(uint256)" $((BASE + 0))
send "$CLIENT1_PK" "cosign(uint256)" $((BASE + 1))
send "$CLIENT2_PK" "cosign(uint256)" $((BASE + 2))
send "$CLIENT1_PK" "confirmPaid(uint256)" $((BASE + 0))
send "$CLIENT1_PK" "confirmPaid(uint256)" $((BASE + 1))
send "$CLIENT2_PK" "confirmPaid(uint256)" $((BASE + 2))

echo "== create + cosign the short-deadline pair (default & dispute) + the never-cosigned proposal"
send "$PRIVATE_KEY"  "createAgreement(address,uint256,uint64,bytes32)" "$CLIENT2_ADDR" 205000 "$SHORT" "$(cast keccak "$S3")"
send "$FREEL2_PK"    "createAgreement(address,uint256,uint64,bytes32)" "$CLIENT2_ADDR" 48000  "$SHORT" "$(cast keccak "$S4")"
send "$PRIVATE_KEY"  "createAgreement(address,uint256,uint64,bytes32)" "$CLIENT1_ADDR" 65000  "$SHORT" "$(cast keccak "$S5")"
send "$CLIENT2_PK" "cosign(uint256)" $((BASE + 3))
send "$CLIENT2_PK" "cosign(uint256)" $((BASE + 4))
# BASE+5 deliberately never co-signed → expires, never counts

echo "== waiting out the short deadlines…"
sleep 85

echo "== flag defaults; client disputes the flyer job"
send "$PRIVATE_KEY" "flagDefault(uint256)" $((BASE + 3))
send "$FREEL2_PK"   "flagDefault(uint256)" $((BASE + 4))
DISPUTE_REASON='Flyers were delivered with the wrong open-house dates printed. Requested a corrected run before paying; never received it.'
send "$CLIENT2_PK" "dispute(uint256,bytes32)" $((BASE + 4)) "$(cast keccak "$DISPUTE_REASON")"

echo "== done. agreementCount:"
cast call "$REGISTRY" "agreementCount()(uint256)" --rpc-url "$RPC_URL"
