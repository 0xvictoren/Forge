/**
 * Originality samples for Node callers (seller CLI, E2E scripts). Text is
 * sampled like the browser does; other files are checked by SHA-256 only.
 */
import { batchSamples, combineReports, TEXT_EXT, TEXT_SAMPLE_BYTES, type OriginalityFile, type OriginalityReport } from "./originality-types";

export function nodeSample(path: string, bytes: Uint8Array, sha256: string, mime = ""): OriginalityFile {
  const base = { sha256, path, sizeBytes: bytes.byteLength, mime };
  if (!(mime.startsWith("text/") || /json|xml|csv|yaml/.test(mime) || TEXT_EXT.test(path))) return { ...base, kind: "binary" };
  const dec = new TextDecoder("utf-8", { fatal: false });
  if (bytes.byteLength <= TEXT_SAMPLE_BYTES * 3) return { ...base, kind: "text", text: dec.decode(bytes) };
  const at = [0, Math.floor(bytes.byteLength / 2 - TEXT_SAMPLE_BYTES / 2), bytes.byteLength - TEXT_SAMPLE_BYTES];
  return { ...base, kind: "text", text: at.map((a) => dec.decode(bytes.subarray(a, a + TEXT_SAMPLE_BYTES))).join("\n") };
}

/** Score samples against a draft version. `post` sends JSON with the seller's session. */
export async function checkOriginality(
  versionId: string,
  samples: OriginalityFile[],
  post: (url: string, body: unknown) => Promise<{ report?: OriginalityReport; skipped?: boolean }>
): Promise<OriginalityReport | null> {
  const reports: OriginalityReport[] = [];
  for (const batch of batchSamples(samples)) {
    const res = await post(`/api/datasets/versions/${versionId}/originality`, { files: batch });
    if (res.report) reports.push(res.report);
  }
  return reports.length ? combineReports(reports) : null;
}
