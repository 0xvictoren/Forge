import { AccountAddress } from "@aptos-labs/ts-sdk";

export type ForgePurchaseIntent = {
  id: string;
  recipient: string;
  amountAtomic: string;
  feeAtomic: string;
  netAtomic: string;
  feeBps: number;
  productIdentifier: string;
  versionIdentifier: string;
  nonce: string;
  termsHash: string;
  expiresAt: string;
};

export function hexBytes(value: string): string {
  const unprefixed = value.startsWith("0x") ? value.slice(2) : value;
  if (!unprefixed || unprefixed.length % 2 !== 0 || !/^[0-9a-f]+$/i.test(unprefixed)) {
    throw new Error("Settlement identifier must be non-empty hexadecimal bytes");
  }
  return `0x${unprefixed.toLowerCase()}`;
}

/**
 * Raw bytes for a Move `vector<u8>` argument. The Aptos SDK encodes a plain
 * string argument as UTF-8 text, so passing "0x…" would send 66 bytes instead
 * of 32 and trip the contract's length checks.
 */
export function hexToVectorU8(value: string): Uint8Array {
  const hex = hexBytes(value).slice(2);
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

export function buildForgePurchasePayload(
  moduleAddress: string,
  intent: ForgePurchaseIntent
) {
  if (!moduleAddress) throw new Error("Forge contract address is not configured");
  const expiresAt = Math.floor(new Date(intent.expiresAt).getTime() / 1_000);
  if (!Number.isSafeInteger(expiresAt) || expiresAt <= 0) {
    throw new Error("Payment intent expiry is invalid");
  }

  return {
    function: `${AccountAddress.from(moduleAddress, { maxMissingChars: 63 }).toString()}::forge::settle_purchase` as `${string}::forge::settle_purchase`,
    typeArguments: [] as string[],
    functionArguments: [
      AccountAddress.from(intent.recipient, { maxMissingChars: 63 }).toString(),
      BigInt(intent.amountAtomic).toString(),
      hexToVectorU8(intent.id),
      hexToVectorU8(intent.productIdentifier),
      hexToVectorU8(intent.versionIdentifier),
      hexToVectorU8(intent.nonce),
      hexToVectorU8(intent.termsHash),
      String(expiresAt),
    ],
  };
}

export function calculateAtomicSettlement(amountAtomic: bigint, feeBps: number) {
  if (amountAtomic <= BigInt(0)) throw new Error("Settlement amount must be positive");
  if (!Number.isInteger(feeBps) || feeBps < 0 || feeBps >= 10_000) {
    throw new Error("Fee basis points are invalid");
  }
  const feeAtomic = (amountAtomic * BigInt(feeBps)) / BigInt(10_000);
  return { feeAtomic, netAtomic: amountAtomic - feeAtomic };
}
