import { canonicalJson, sha256Hex } from "./hash";

/**
 * A manifest describes the *content* of a dataset version. Storage locations
 * (Shelby blob refs) are deliberately excluded so data can be re-stored or
 * renewed without invalidating the seal.
 */
export type ManifestFile = {
  path: string;
  sizeBytes: number;
  sha256: string;
  mimeType: string;
};

export type DatasetManifest = {
  schema: "forge.manifest/v1";
  datasetId: string;
  versionNumber: number;
  files: ManifestFile[];
  totals: { fileCount: number; totalBytes: number };
};

export const SOURCE_TYPES = [
  "SELF_COLLECTED",
  "LICENSED_FROM_THIRD_PARTY",
  "PUBLICLY_AVAILABLE",
  "SYNTHETIC",
  "WEB_CRAWLED",
  "USER_CONTRIBUTED",
] as const;
export type SourceType = (typeof SOURCE_TYPES)[number];

export const SOURCE_TYPE_LABELS: Record<SourceType, string> = {
  SELF_COLLECTED: "Collected by us",
  LICENSED_FROM_THIRD_PARTY: "Licensed from a third party",
  PUBLICLY_AVAILABLE: "Publicly available",
  SYNTHETIC: "Synthetic / generated",
  WEB_CRAWLED: "Crawled from the web",
  USER_CONTRIBUTED: "Contributed by users",
};

/** Datasheet fields - mapped onto the EU AI Office training-data summary template. */
export type Datasheet = {
  schema: "forge.datasheet/v1";
  sourceType: SourceType;
  sourceDescription: string;
  collectionStart?: string;
  collectionEnd?: string;
  geographies: string[];
  languages: string[];
  modalities: string[];
  containsPersonalData: boolean;
  consentBasis?: string;
  rightsStatement: string;
  respectsTdmOptOut: boolean;
  processingSteps?: string;
  knownLimitations?: string;
  contactEmail?: string;
};

export function normalizeManifestPath(path: string): string {
  return path.replace(/\\/g, "/").replace(/^\/+/, "").replace(/\/{2,}/g, "/").trim();
}

export function buildManifest(input: {
  datasetId: string;
  versionNumber: number;
  files: ManifestFile[];
}): DatasetManifest {
  const seen = new Set<string>();
  const files = input.files
    .map((f) => ({
      path: normalizeManifestPath(f.path),
      sizeBytes: Math.trunc(f.sizeBytes),
      sha256: f.sha256.toLowerCase(),
      mimeType: f.mimeType || "application/octet-stream",
    }))
    .sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  for (const f of files) {
    if (!f.path) throw new Error("Manifest file path cannot be empty");
    if (seen.has(f.path)) throw new Error(`Duplicate file path in manifest: ${f.path}`);
    if (!/^[0-9a-f]{64}$/.test(f.sha256)) throw new Error(`Invalid sha256 for ${f.path}`);
    seen.add(f.path);
  }
  return {
    schema: "forge.manifest/v1",
    datasetId: input.datasetId,
    versionNumber: input.versionNumber,
    files,
    totals: {
      fileCount: files.length,
      totalBytes: files.reduce((sum, f) => sum + f.sizeBytes, 0),
    },
  };
}

export async function hashManifest(manifest: DatasetManifest): Promise<string> {
  return sha256Hex(canonicalJson(manifest));
}

export async function hashDatasheet(datasheet: Datasheet): Promise<string> {
  return sha256Hex(canonicalJson(datasheet));
}

/** The seal binds dataset, version, content and declarations into one 32-byte digest. */
export async function computeSealHash(input: {
  datasetId: string;
  versionNumber: number;
  manifestHash: string;
  datasheetHash: string;
}): Promise<string> {
  return sha256Hex(
    canonicalJson({
      schema: "forge.seal/v1",
      datasetId: input.datasetId,
      versionNumber: input.versionNumber,
      manifestHash: input.manifestHash,
      datasheetHash: input.datasheetHash,
    })
  );
}

export function validateDatasheet(value: unknown): { ok: true; datasheet: Datasheet } | { ok: false; error: string } {
  if (!value || typeof value !== "object") return { ok: false, error: "Datasheet is required" };
  const d = value as Partial<Datasheet>;
  if (!d.sourceType || !SOURCE_TYPES.includes(d.sourceType)) return { ok: false, error: "Choose where the data came from" };
  if (!d.sourceDescription || d.sourceDescription.trim().length < 10) {
    return { ok: false, error: "Describe the source in at least a sentence" };
  }
  if (!d.rightsStatement || d.rightsStatement.trim().length < 10) {
    return { ok: false, error: "State which rights you hold over this data" };
  }
  if (typeof d.containsPersonalData !== "boolean") return { ok: false, error: "Say whether the data contains personal data" };
  if (d.containsPersonalData && !d.consentBasis?.trim()) {
    return { ok: false, error: "Personal data requires a consent or legal basis" };
  }
  const list = (v: unknown) => (Array.isArray(v) ? v.map((s) => String(s).trim()).filter(Boolean).slice(0, 50) : []);
  return {
    ok: true,
    datasheet: {
      schema: "forge.datasheet/v1",
      sourceType: d.sourceType,
      sourceDescription: d.sourceDescription.trim(),
      collectionStart: d.collectionStart || undefined,
      collectionEnd: d.collectionEnd || undefined,
      geographies: list(d.geographies),
      languages: list(d.languages),
      modalities: list(d.modalities),
      containsPersonalData: d.containsPersonalData,
      consentBasis: d.consentBasis?.trim() || undefined,
      rightsStatement: d.rightsStatement.trim(),
      respectsTdmOptOut: !!d.respectsTdmOptOut,
      processingSteps: d.processingSteps?.trim() || undefined,
      knownLimitations: d.knownLimitations?.trim() || undefined,
      contactEmail: d.contactEmail?.trim() || undefined,
    },
  };
}
