import "server-only";
import { randomBytes } from "crypto";
import type { Dataset, DatasetFile, DatasetLicense, DatasetVersion, User } from "@prisma/client";
import { prisma } from "@/lib/db";
import { base64ToBytes, decryptAesGcm, unwrapKey } from "@/lib/encryption";
import { downloadFromShelby, streamFromShelby } from "@/lib/shelby-server";
import { getShelbyPublicUrl } from "@/lib/shelby-public";
import { getExplorerUrl } from "@/lib/aptos";
import { requestIp } from "@/lib/rate-limit";
import { slugify } from "@/lib/utils";
import { decryptBufferChunked, decryptStreamChunked } from "./chunked-crypto";
import { detectFingerprintFormat, fingerprintContent } from "./fingerprint";
import { sha256Hex } from "./hash";
import { LICENSE_TEMPLATES, parseOffers, type LicenseTemplate } from "./licenses";
import { parseReadPricing } from "@/lib/agents/pricing";
import type { Datasheet, DatasetManifest } from "./manifest";

/** Text files above this size are delivered without fingerprinting (streamed). */
export const MAX_FINGERPRINT_BYTES = 256 * 1024 * 1024;
/** Per licence, per file, per rolling 24h. */
export const MAX_DELIVERIES_PER_FILE_PER_DAY = 5;

export function newFingerprintId(): string {
  return randomBytes(8).toString("hex");
}

export function newSecretHex(bytes = 32): string {
  return randomBytes(bytes).toString("hex");
}

export async function uniqueDatasetSlug(title: string): Promise<string> {
  const base = slugify(title).slice(0, 60) || "dataset";
  for (let i = 0; i < 6; i++) {
    const slug = i === 0 ? base : `${base}-${randomBytes(2).toString("hex")}`;
    const exists = await prisma.dataset.findUnique({ where: { slug }, select: { id: true } });
    if (!exists) return slug;
  }
  return `${base}-${randomBytes(4).toString("hex")}`;
}

type OwnerLite = Pick<User, "id" | "displayName" | "username" | "handle" | "walletAddress" | "address" | "verified">;

export function publicOwner(owner: OwnerLite) {
  return {
    id: owner.id,
    name: owner.displayName || owner.username || owner.handle || "Anonymous seller",
    handle: owner.username || owner.handle || null,
    verified: owner.verified,
    wallet: owner.walletAddress || owner.address || null,
  };
}

export function publicVersion(v: DatasetVersion & { files?: DatasetFile[] }) {
  return {
    id: v.id,
    versionNumber: v.versionNumber,
    status: v.status,
    changelog: v.changelog,
    fileCount: v.fileCount,
    totalBytes: v.totalBytes,
    manifestHash: v.manifestHash,
    datasheetHash: v.datasheetHash,
    sealHash: v.sealHash,
    anchorTxHash: v.anchorTxHash,
    anchorExplorerUrl: v.anchorTxHash ? getExplorerUrl(v.anchorTxHash) : null,
    anchoredAt: v.anchoredAt,
    sealedAt: v.sealedAt,
    datasheet: (v.datasheet as Datasheet | null) ?? null,
    manifest: (v.manifest as DatasetManifest | null) ?? null,
    samples: (v.files || [])
      .filter((f) => f.isSample)
      .map((f) => ({ id: f.id, path: f.path, sizeBytes: f.sizeBytes, mimeType: f.mimeType, url: getShelbyPublicUrl(f.blobRef) })),
  };
}

export function publicDataset(
  d: Dataset & { owner: OwnerLite; versions?: (DatasetVersion & { files?: DatasetFile[] })[] }
) {
  const latest = d.versions?.find((v) => v.id === d.latestVersionId) ?? d.versions?.find((v) => v.status === "SEALED");
  return {
    id: d.id,
    slug: d.slug,
    title: d.title,
    tagline: d.tagline,
    description: d.description,
    modality: d.modality,
    tags: d.tags,
    coverUrl: d.coverUrl,
    coverCredit: d.coverCredit,
    visibility: d.visibility,
    status: d.status,
    offers: parseOffers(d.offers),
    readPricing: parseReadPricing(d.readPricing),
    licenseCount: d.licenseCount,
    viewCount: d.viewCount,
    createdAt: d.createdAt,
    updatedAt: d.updatedAt,
    owner: publicOwner(d.owner),
    latestVersion: latest ? publicVersion(latest) : null,
  };
}

export type PublicDataset = ReturnType<typeof publicDataset>;

export async function getActiveLicense(userId: string, datasetId: string) {
  return prisma.datasetLicense.findFirst({
    where: { buyerId: userId, datasetId, status: "ACTIVE" },
    orderBy: { createdAt: "desc" },
  });
}

/** Licence templates that include later sealed versions of the same dataset. */
export const TEMPLATES_WITH_UPDATES = ["COMMERCIAL", "EXCLUSIVE"];

export function licenseCoversVersion(
  license: DatasetLicense & { version: Pick<DatasetVersion, "versionNumber"> },
  version: Pick<DatasetVersion, "id" | "versionNumber" | "status">
) {
  if (license.status !== "ACTIVE" || version.status !== "SEALED") return false;
  // Metered licences only authorise paid reads (lib/agents/read.ts), never free downloads.
  if (license.template === "METERED") return false;
  if (license.versionId === version.id) return true;
  return TEMPLATES_WITH_UPDATES.includes(license.template) && version.versionNumber >= license.version.versionNumber;
}

/**
 * The licence a delivery is bound to when a buyer holds several: the broadest
 * rights win, so a paid commercial copy is never fingerprinted as research use.
 * Ties go to the first in `licenses` (callers pass newest first).
 */
export function bestCoveringLicense<L extends DatasetLicense & { version: Pick<DatasetVersion, "versionNumber"> }>(
  licenses: L[],
  version: Pick<DatasetVersion, "id" | "versionNumber" | "status">
): L | undefined {
  const rank = (l: L) => LICENSE_TEMPLATES.indexOf(l.template as LicenseTemplate);
  let best: L | undefined;
  for (const l of licenses) {
    if (licenseCoversVersion(l, version) && (!best || rank(l) > rank(best))) best = l;
  }
  return best;
}

/** Owners see everything; licensees see the versions their licence covers. */
export async function resolveFileAccess(userId: string, file: DatasetFile & { version: DatasetVersion & { dataset: Dataset } }) {
  if (file.version.dataset.ownerId === userId) return { allowed: true as const, isOwner: true, license: null };
  const licenses = await prisma.datasetLicense.findMany({
    where: { buyerId: userId, datasetId: file.version.datasetId, status: "ACTIVE" },
    include: { version: { select: { versionNumber: true } } },
    orderBy: { createdAt: "desc" },
  });
  const license = bestCoveringLicense(licenses, file.version);
  if (!license) return { allowed: false as const, isOwner: false, license: null };
  return { allowed: true as const, isOwner: false, license };
}

async function contentKeyFor(file: DatasetFile): Promise<Uint8Array> {
  if (!file.wrappedKeyShare || !file.encryptionShareKey) throw new Error("File key material is missing");
  return unwrapKey(file.wrappedKeyShare, base64ToBytes(file.encryptionShareKey));
}

export async function countRecentDeliveries(licenseId: string, fileId: string) {
  return prisma.datasetAccessLog.count({
    where: {
      licenseId,
      fileId,
      action: { in: ["DOWNLOAD", "PIPELINE"] },
      createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    },
  });
}

export type Delivery =
  | { kind: "buffer"; body: Uint8Array; sha256: string; fingerprinted: boolean }
  | { kind: "stream"; body: ReadableStream<Uint8Array>; fingerprinted: false };

/**
 * Produce the bytes a given user receives for a file. Licensees always get a
 * fingerprinted copy for text formats; owners get the original.
 */
export async function deliverFile(file: DatasetFile, license: DatasetLicense | null): Promise<Delivery> {
  const format = detectFingerprintFormat(file.path, file.mimeType);
  const shouldFingerprint = !!license && format !== "binary" && file.sizeBytes <= MAX_FINGERPRINT_BYTES;

  if (!file.isEncrypted) {
    if (!shouldFingerprint) return { kind: "stream", body: await streamFromShelby(file.blobRef), fingerprinted: false };
    const { data } = await downloadFromShelby(file.blobRef);
    return fingerprintBuffer(new Uint8Array(data), file, license!, format);
  }

  const key = await contentKeyFor(file);

  if (!shouldFingerprint && file.encryptionVersion === 2) {
    const source = await streamFromShelby(file.blobRef);
    return { kind: "stream", body: source.pipeThrough(decryptStreamChunked(key)), fingerprinted: false };
  }

  const { data } = await downloadFromShelby(file.blobRef);
  const cipher = new Uint8Array(data);
  const plain = file.encryptionVersion === 2 ? await decryptBufferChunked(cipher, key) : await decryptAesGcm(cipher, key);

  if (!shouldFingerprint) return { kind: "buffer", body: plain, sha256: await sha256Hex(plain), fingerprinted: false };
  return fingerprintBuffer(plain, file, license!, format);
}

async function fingerprintBuffer(
  plain: Uint8Array,
  file: DatasetFile,
  license: DatasetLicense,
  format: ReturnType<typeof detectFingerprintFormat>
): Promise<Delivery> {
  const text = new TextDecoder("utf-8", { fatal: false }).decode(plain);
  const result = await fingerprintContent(text, format, {
    seedHex: license.canarySeed,
    fingerprintId: license.fingerprintId,
    fileId: file.id,
  });
  const body = new TextEncoder().encode(result.text);
  return { kind: "buffer", body, sha256: await sha256Hex(body), fingerprinted: true };
}

/** Original plaintext, for the seller's leak tracing. */
export async function readOriginalText(file: DatasetFile): Promise<string> {
  const { data } = await downloadFromShelby(file.blobRef);
  let bytes: Uint8Array = new Uint8Array(data);
  if (file.isEncrypted) {
    const key = await contentKeyFor(file);
    bytes = file.encryptionVersion === 2 ? await decryptBufferChunked(bytes, key) : await decryptAesGcm(bytes, key);
  }
  return new TextDecoder().decode(bytes);
}

export async function logDatasetAccess(input: {
  request?: Request;
  datasetId: string;
  licenseId?: string | null;
  userId?: string | null;
  fileId?: string | null;
  action: "KEY_RELEASE" | "DOWNLOAD" | "PIPELINE" | "CREDENTIAL" | "SAMPLE" | "TRACE";
  deliveredSha256?: string | null;
}) {
  try {
    await prisma.datasetAccessLog.create({
      data: {
        datasetId: input.datasetId,
        licenseId: input.licenseId || null,
        userId: input.userId || null,
        fileId: input.fileId || null,
        action: input.action,
        deliveredSha256: input.deliveredSha256 || null,
        ip: input.request ? requestIp(input.request) : null,
        userAgent: input.request?.headers.get("user-agent")?.slice(0, 300) || null,
      },
    });
    if (input.licenseId && (input.action === "DOWNLOAD" || input.action === "PIPELINE")) {
      await prisma.datasetLicense.update({
        where: { id: input.licenseId },
        data: { downloadCount: { increment: 1 }, lastAccessAt: new Date() },
      });
    }
  } catch {
    /* logging must never block delivery */
  }
}

export function contentDisposition(path: string) {
  const name = path.split("/").pop() || "file";
  const ascii = name.replace(/[^\x20-\x7e]/g, "_").replace(/"/g, "'");
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(name)}`;
}
