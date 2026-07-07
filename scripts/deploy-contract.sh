#!/usr/bin/env bash
# Deploy Forge module to Aptos ShelbyNet
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
if [ -f "$ROOT/.env" ]; then
  set -a
  # shellcheck disable=SC1091
  source "$ROOT/.env"
  set +a
fi

DEPLOYER="${DEPLOYER_ADDRESS:-0x8e9918d910feda3733f078af8fcf17e4a07eed9e255f4261779ca1ba55c642b6}"
NODE_URL="${APTOS_NODE_URL:-https://api.shelbynet.shelby.xyz/v1}"
PROFILE="${APTOS_PROFILE:-}"
PK="${SHELBY_SIGNER_PRIVATE_KEY:-}"
TREASURY="${NEXT_PUBLIC_PLATFORM_ADDRESS:-0x3b89c6e123ebc9657431c9a9bfac99b0b581610772808ef79ac4d4f7cfc9ae6c}"

cd "$(dirname "$0")/../move"
export APTOS_CONFIG_DIR="$ROOT/.aptos"

GAS_UNIT_PRICE="${GAS_UNIT_PRICE:-100}"
MAX_GAS="${MAX_GAS:-100000}"

AUTH_ARGS=()
if [ -n "$PROFILE" ]; then
  AUTH_ARGS=(--profile "$PROFILE")
elif [ -n "$PK" ]; then
  AUTH_ARGS=(--private-key "$PK")
else
  echo "Set APTOS_PROFILE=shelby or SHELBY_SIGNER_PRIVATE_KEY in .env" >&2
  exit 1
fi

echo "Compiling forge module for $DEPLOYER..."
aptos move compile --named-addresses "forge=$DEPLOYER"

echo "Publishing..."
aptos move publish \
  --named-addresses "forge=$DEPLOYER" \
  "${AUTH_ARGS[@]}" \
  --url "$NODE_URL" \
  --gas-unit-price "$GAS_UNIT_PRICE" \
  --max-gas "$MAX_GAS" \
  --assume-yes

echo "Initializing platform (treasury=$TREASURY)..."
aptos move run \
  --function-id "${DEPLOYER}::forge::initialize_platform" \
  --args "address:${TREASURY}" \
  "${AUTH_ARGS[@]}" \
  --url "$NODE_URL" \
  --gas-unit-price "$GAS_UNIT_PRICE" \
  --max-gas "$MAX_GAS" \
  --assume-yes

echo "Done. Set in .env:"
echo "NEXT_PUBLIC_CONTRACT_ADDRESS=$DEPLOYER"
echo "NEXT_PUBLIC_MODULE_ADDRESS=$DEPLOYER"
