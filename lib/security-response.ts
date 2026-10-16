const ENCRYPTION_SECRET_FIELDS = new Set([
  "wrappedKeyOwner",
  "wrappedKeyShare",
  "encryptionShareKey",
  "dataBase64",
]);

const STORAGE_REFERENCE_FIELDS = new Set([
  "blobRef",
  "blobId",
  "shelbyCid",
  "pdfBlobId",
]);

/**
 * Defense-in-depth response redaction for Prisma result trees.
 * Encryption material never belongs in general API payloads; callers that have
 * completed an explicit access check must use a dedicated key-package route.
 */
export function redactSensitiveResponse<T>(
  value: T,
  options: { redactStorageReferences?: boolean } = {}
): T {
  if (value == null || typeof value !== "object") return value;
  if (value instanceof Date) return value;
  if (Array.isArray(value)) {
    return value.map((item) => redactSensitiveResponse(item, options)) as T;
  }

  const output: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    if (ENCRYPTION_SECRET_FIELDS.has(key)) continue;
    if (options.redactStorageReferences && STORAGE_REFERENCE_FIELDS.has(key)) continue;
    output[key] = redactSensitiveResponse(item, options);
  }
  return output as T;
}
