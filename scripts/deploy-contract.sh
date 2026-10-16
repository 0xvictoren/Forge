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

DEPLOYER="${FORGE_DEPLOYER_ADDRESS:-}"
NODE_URL="${APTOS_NODE_URL:-https://api.shelbynet.shelby.xyz/v1}"
PROFILE="${APTOS_PROFILE:-}"
PK="${SHELBY_SIGNER_PRIVATE_KEY:-}"
TREASURY="${FORGE_TREASURY_ADDRESS:-}"

if [ -z "$DEPLOYER" ] || [ -z "$TREASURY" ]; then
  echo "Set FORGE_DEPLOYER_ADDRESS and FORGE_TREASURY_ADDRESS explicitly. Deployment has no address defaults." >&2
  exit 1
fi
EXPECTED_CONFIRMATION="${DEPLOYER}:${TREASURY}"
if [ "${CONFIRM_FORGE_DEPLOYMENT:-}" != "$EXPECTED_CONFIRMATION" ]; then
  echo "Set CONFIRM_FORGE_DEPLOYMENT=$EXPECTED_CONFIRMATION after independently confirming both addresses." >&2
  exit 1
fi

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
