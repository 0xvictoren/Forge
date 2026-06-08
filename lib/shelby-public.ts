import { GATEWAY } from "./constants-shelby";

export type ShelbyUploadResult = {
  cid: string;
  mimeType: string;
  size: number;
  account: string;
  blobName: string;
};

const BLOB_REF_PREFIX = "shelby:";

export function encodeBlobRef(account: string, blobName: string): string {
  return `${BLOB_REF_PREFIX}${account}::${blobName}`;
}

/** Extract original filename (with extension) from a Shelby blob name path. */
export function fileNameFromBlobRef(ref: string): string | null {
  const parsed = parseBlobRef(ref);
  if (!parsed) return null;
  const segment = parsed.blobName.split("/").pop() || "";
  const dash = segment.indexOf("-");
  if (dash >= 0 && dash < segment.length - 1) {
    return segment.slice(dash + 1);
  }
  return segment || null;
}

export function parseBlobRef(ref: string): { account: string; blobName: string } | null {
  if (!ref.startsWith(BLOB_REF_PREFIX)) return null;
  const body = ref.slice(BLOB_REF_PREFIX.length);
  const sep = body.indexOf("::");
  if (sep <= 0) return null;
  return { account: body.slice(0, sep), blobName: body.slice(sep + 2) };
}

export function getShelbyPublicUrl(ref: string): string {
  if (!ref) return "";
  if (ref.startsWith("http")) return ref;
  if (parseBlobRef(ref)) {
    return `/api/media/shelby?ref=${encodeURIComponent(ref)}`;
  }
  if (ref.startsWith("dev-")) {
    return `/api/media/blob/${encodeURIComponent(ref)}`;
  }
  return `${GATEWAY}/ipfs/${ref}`;
}

export function getShelbyPreviewUrl(ref: string, seconds?: number): string {
  if (parseBlobRef(ref)) return getShelbyPublicUrl(ref);
  const base = `${GATEWAY}/preview/${ref}`;
  return seconds ? `${base}?t=${seconds}` : base;
}

export async function getShelbyGatedUrl(
  ref: string,
  _walletAddress: string,
  _signature: string
): Promise<string> {
  return getShelbyPublicUrl(ref);
}
