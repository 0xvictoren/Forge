import "server-only";
import { CONTRACT_ADDRESS } from "@/lib/constants";
import { getAptosClient } from "@/lib/aptos";
import { hexBytes } from "@/lib/forge-purchase";
import { normalizeAddress } from "@/lib/payments";
import { idToHex } from "./provenance";

export type AnchorExpectation = {
  owner: string;
  datasetId: string;
  versionNumber: number;
  manifestHash: string;
  datasheetHash: string;
  sealHash: string;
};

function sameHex(actual: unknown, expected: string) {
  try {
    return hexBytes(String(actual)) === hexBytes(expected);
  } catch {
    return false;
  }
}

/** Confirm an Aptos transaction emitted the exact ProvenanceAnchored event we expect. */
export async function verifyAnchorTransaction(
  txHash: string,
  expected: AnchorExpectation
): Promise<{ valid: boolean; error?: string; anchoredAt?: Date }> {
  if (!/^0x[0-9a-f]{64}$/i.test(txHash)) return { valid: false, error: "Invalid transaction hash" };
  if (!CONTRACT_ADDRESS) return { valid: false, error: "Forge contract address is not configured" };
  try {
    const aptos = getAptosClient();
    await aptos.waitForTransaction({ transactionHash: txHash, options: { checkSuccess: true, timeoutSecs: 60 } });
    const tx = (await aptos.getTransactionByHash({ transactionHash: txHash })) as Record<string, unknown>;
    if (tx.success === false) return { valid: false, error: "Transaction failed onchain" };
    const moduleAddress = normalizeAddress(CONTRACT_ADDRESS);
    const eventType = `${moduleAddress}::forge::ProvenanceAnchored`.toLowerCase();
    const events = (tx.events || []) as Array<{ type?: string; data?: Record<string, unknown> }>;
    const event = events.find((e) => e.type?.toLowerCase() === eventType);
    if (!event?.data) return { valid: false, error: "Provenance event not found in transaction" };
    const d = event.data;
    const ok =
      normalizeAddress(String(d.owner)) === normalizeAddress(expected.owner) &&
      sameHex(d.dataset_id, idToHex(expected.datasetId)) &&
      String(d.version_number) === String(expected.versionNumber) &&
      sameHex(d.manifest_hash, expected.manifestHash) &&
      sameHex(d.datasheet_hash, expected.datasheetHash) &&
      sameHex(d.seal_hash, expected.sealHash);
    if (!ok) return { valid: false, error: "Onchain seal does not match this dataset version" };
    return { valid: true, anchoredAt: new Date(Number(d.anchored_at) * 1000) };
  } catch (error) {
    return { valid: false, error: error instanceof Error ? error.message : "Anchor verification failed" };
  }
}
