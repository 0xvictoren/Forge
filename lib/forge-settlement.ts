import { CONTRACT_ADDRESS } from "./constants";
import { getAptosClient } from "./aptos";
import { calculateAtomicSettlement, hexBytes } from "./forge-purchase";
import { normalizeAddress } from "./payments";

type ExpectedForgeSettlement = {
  buyer: string;
  seller: string;
  amountAtomic: string;
  feeBps: number;
  purchaseIntentId: string;
  productIdentifier: string;
  versionIdentifier: string;
  nonce: string;
  termsHash: string;
  expiresAt: Date;
  notBefore: Date;
};

function sameHex(actual: unknown, expected: string): boolean {
  try {
    return hexBytes(String(actual)) === hexBytes(expected);
  } catch {
    return false;
  }
}

export async function verifyForgeSettlement(
  txHash: string,
  expected: ExpectedForgeSettlement
): Promise<{ valid: boolean; error?: string; feeAtomic?: string; netAtomic?: string }> {
  if (!txHash?.startsWith("0x")) return { valid: false, error: "Invalid transaction hash" };
  if (!CONTRACT_ADDRESS) return { valid: false, error: "Forge contract address is not configured" };

  try {
    const aptos = getAptosClient();
    await aptos.waitForTransaction({
      transactionHash: txHash,
      options: { checkSuccess: true, timeoutSecs: 60 },
    });
    const tx = (await aptos.getTransactionByHash({ transactionHash: txHash })) as Record<string, unknown>;
    if (tx.success === false) return { valid: false, error: "Transaction failed onchain" };
    if (!tx.sender || normalizeAddress(String(tx.sender)) !== normalizeAddress(expected.buyer)) {
      return { valid: false, error: "Settlement buyer mismatch" };
    }

    if (tx.timestamp != null) {
      const timestampMs = Number(BigInt(String(tx.timestamp)) / BigInt(1_000));
      if (timestampMs < expected.notBefore.getTime()) {
        return { valid: false, error: "Transaction predates the payment intent" };
      }
      if (timestampMs > expected.expiresAt.getTime() + 1_000) {
        return { valid: false, error: "Transaction settled after the intent expired" };
      }
    }

    const moduleAddress = normalizeAddress(CONTRACT_ADDRESS);
    const payload = tx.payload as { function?: string } | undefined;
    const expectedFunction = `${moduleAddress}::forge::settle_purchase`;
    if (!payload?.function || payload.function.toLowerCase() !== expectedFunction.toLowerCase()) {
      return { valid: false, error: "Transaction did not call the Forge settlement contract" };
    }

    const events = (tx.events || []) as Array<{ type?: string; data?: Record<string, unknown> }>;
    const event = events.find(
      (candidate) => candidate.type?.toLowerCase() === `${moduleAddress}::forge::PaymentSettled`.toLowerCase()
    );
    if (!event?.data) return { valid: false, error: "Forge settlement event not found" };
    const data = event.data;

    const amount = BigInt(String(data.amount_octas));
    const { feeAtomic, netAtomic } = calculateAtomicSettlement(amount, expected.feeBps);
    const addressesMatch =
      normalizeAddress(String(data.buyer)) === normalizeAddress(expected.buyer) &&
      normalizeAddress(String(data.seller)) === normalizeAddress(expected.seller);
    const fieldsMatch =
      amount.toString() === BigInt(expected.amountAtomic).toString() &&
      String(data.fee_bps) === String(expected.feeBps) &&
      String(data.fee_octas) === feeAtomic.toString() &&
      String(data.net_octas) === netAtomic.toString() &&
      sameHex(data.purchase_intent_id, expected.purchaseIntentId) &&
      sameHex(data.product_id, expected.productIdentifier) &&
      sameHex(data.version_id, expected.versionIdentifier) &&
      sameHex(data.nonce, expected.nonce) &&
      sameHex(data.terms_hash, expected.termsHash) &&
      String(data.intent_expires_at) === String(Math.floor(expected.expiresAt.getTime() / 1_000));

    if (!addressesMatch || !fieldsMatch) {
      return { valid: false, error: "Settlement event does not match the server-issued intent" };
    }
    return { valid: true, feeAtomic: feeAtomic.toString(), netAtomic: netAtomic.toString() };
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : "Settlement verification failed",
    };
  }
}
