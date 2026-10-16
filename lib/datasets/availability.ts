import "server-only";
import { AccountAddress } from "@aptos-labs/ts-sdk";
import { isBlobCommitted, SHELBY_DEPLOYER } from "@shelby-protocol/sdk/node";
import { prisma } from "@/lib/db";
import { getAptosClient } from "@/lib/aptos";
import { getShelbyClient } from "@/lib/shelby-client";
import { parseBlobRef } from "@/lib/shelby-public";

export type Availability = {
  checkedAt: string;
  auditEpoch: string | null;
  filesTotal: number;
  filesChecked: number;
  committed: number;
  /** Storage-provider acknowledgements recorded onchain, summed over checked files. */
  providerAcks: number;
  missing: string[];
  status: "available" | "degraded" | "unavailable" | "unknown";
};

const CACHE_MS = 10 * 60 * 1000;
const SAMPLE = 12;
const cache = new Map<string, { at: number; value: Availability }>();

const popcount = (n: number) => {
  let c = 0;
  for (let x = n >>> 0; x; x &= x - 1) c++;
  return c;
};

/**
 * Live availability of a sealed version on Shelby: each sampled file must be
 * committed onchain with storage-provider acknowledgements. Shelby audits
 * providers every epoch, so a committed blob is one the network is proving it
 * still holds. Results are cached for ten minutes.
 */
export async function checkAvailability(versionId: string): Promise<Availability> {
  const hit = cache.get(versionId);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.value;

  const files = await prisma.datasetFile.findMany({ where: { versionId, isSample: false }, select: { path: true, blobRef: true }, orderBy: { path: "asc" } });
  // Deterministic spread across the manifest: first, last and evenly spaced.
  const step = Math.max(1, Math.floor(files.length / SAMPLE));
  const sample = files.filter((_, i) => i % step === 0).slice(0, SAMPLE);

  let auditEpoch: string | null = null;
  try {
    const [epoch] = await getAptosClient().view<[string]>({ payload: { function: `${SHELBY_DEPLOYER}::epoch::get_current_audit_epoch`, functionArguments: [] } });
    auditEpoch = String(epoch);
  } catch {
    /* epoch view is informational */
  }

  let committed = 0;
  let providerAcks = 0;
  const missing: string[] = [];
  let errors = 0;
  const client = getShelbyClient();
  await Promise.all(
    sample.map(async (f) => {
      const ref = parseBlobRef(f.blobRef);
      if (!ref) return void missing.push(f.path);
      try {
        const meta = await client.coordination.getObjectBlobMetadata({ account: AccountAddress.from(ref.account), name: ref.blobName });
        if (meta && isBlobCommitted(meta.blob.state)) {
          committed++;
          providerAcks += popcount(meta.blob.acknowledgments);
        } else missing.push(f.path);
      } catch {
        errors++;
      }
    })
  );

  const checked = sample.length - errors;
  const value: Availability = {
    checkedAt: new Date().toISOString(),
    auditEpoch,
    filesTotal: files.length,
    filesChecked: checked,
    committed,
    providerAcks,
    missing,
    status: checked === 0 ? "unknown" : committed === checked ? "available" : committed === 0 ? "unavailable" : "degraded",
  };
  cache.set(versionId, { at: Date.now(), value });
  return value;
}
