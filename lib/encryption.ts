/**
 * Client-side content encryption for Forge.
 *
 * Algorithm: AES-256-GCM (Web Crypto API)
 * Ciphertext format: IV (12 bytes) || ciphertext || authTag (16 bytes, appended by GCM)
 *
 * Key model:
 * 1. Per-file random content key (256-bit) - encrypts the media
 * 2. Owner wrap: content key encrypted with a wallet-derived AES key
 *    (deterministic message signature → HKDF-SHA-256 → AES-256)
 * 3. Share wrap: content key encrypted with a random share secret
 *    Share secret is stored server-side and only released after ownership /
 *    purchase / BurnLink unlock verification (server-mediated multi-party access).
 *
 * Plaintext media and raw content keys never leave the browser unencrypted.
 * Shelby only receives ciphertext. MongoDB stores wrapped keys + share secret.
 */

export const ENCRYPTION_VERSION = 1 as const;
export const AES_KEY_BITS = 256;
export const AES_IV_BYTES = 12;
export const CONTENT_KEY_BYTES = 32;

/** Fixed derivation message - must stay stable so owners can re-derive the same key. */
export const FORGE_KEY_DERIVATION_MESSAGE =
  "Forge Content Encryption Key v1 — this signature never broadcasts and is only used to derive your local decryption key.";

export const FORGE_KEY_DERIVATION_NONCE = "forge-cek-v1";

const HKDF_SALT = new TextEncoder().encode("forge-wallet-key-v1");
const HKDF_INFO = new TextEncoder().encode("forge-aes-256-gcm-v1");

// ─── Types ───────────────────────────────────────────────────────────────────

export type EncryptionMaterial = {
  isEncrypted: true;
  encryptionVersion: typeof ENCRYPTION_VERSION;
  /** Original plaintext MIME type */
  mimeType: string;
  /** Original plaintext byte length */
  plaintextSize: number;
  /** Content key wrapped for the uploader wallet (base64: IV||ct) */
  wrappedKeyOwner: string;
  /** Content key wrapped with the share secret (base64: IV||ct) */
  wrappedKeyShare: string;
  /**
   * Random share secret (base64). Persist in DB; return only after
   * ownership / payment / unlock authorization. Never expose on public endpoints.
   */
  encryptionShareKey: string;
};

export type PublicEncryptionFlags = {
  isEncrypted: boolean;
  encryptionVersion?: number | null;
};

/** Key package returned only to authorized clients. */
export type AuthorizedKeyPackage = {
  isEncrypted: true;
  encryptionVersion: number;
  mimeType?: string | null;
  /** Prefer owner path when present (wallet unwrap). */
  wrappedKeyOwner?: string | null;
  wrappedKeyShare?: string | null;
  /** Present for share/buyer path after auth. */
  encryptionShareKey?: string | null;
  fileName?: string | null;
};

export type EncryptFileResult = {
  /** Ciphertext file (application/octet-stream) ready for Shelby upload */
  encryptedFile: File;
  material: EncryptionMaterial;
  /** Raw content key - keep in memory only; never send to server */
  contentKey: Uint8Array;
};

export type WalletSignMessage = (args: {
  message: string;
  nonce: string;
  address?: boolean;
  application?: boolean;
  chainId?: boolean;
}) => Promise<{
  fullMessage: string;
  message: string;
  nonce: string;
  signature: unknown;
  prefix?: string;
}>;

// ─── Encoding helpers ────────────────────────────────────────────────────────

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

export function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

export function concatBytes(...parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const p of parts) {
    out.set(p, offset);
    offset += p.length;
  }
  return out;
}

function getSubtle(): SubtleCrypto {
  const subtle =
    typeof globalThis !== "undefined"
      ? globalThis.crypto?.subtle
      : undefined;
  if (!subtle) {
    throw new Error(
      "Web Crypto API is unavailable. Use a modern browser with crypto.subtle (HTTPS or localhost)."
    );
  }
  return subtle;
}

/** Normalize Aptos wallet signature objects to raw bytes. */
export function signatureToBytes(signature: unknown): Uint8Array {
  if (!signature) throw new Error("Empty wallet signature");

  if (signature instanceof Uint8Array) return signature;
  if (signature instanceof ArrayBuffer) return new Uint8Array(signature);

  if (typeof signature === "string") {
    const s = signature.trim();
    if (s.startsWith("0x") || /^[0-9a-fA-F]+$/.test(s)) {
      const hex = s.startsWith("0x") ? s.slice(2) : s;
      if (hex.length % 2 !== 0) throw new Error("Invalid hex signature");
      const out = new Uint8Array(hex.length / 2);
      for (let i = 0; i < out.length; i++) {
        out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
      }
      return out;
    }
    // Try base64
    try {
      return base64ToBytes(s);
    } catch {
      throw new Error("Unrecognized signature string format");
    }
  }

  if (typeof signature === "object") {
    const obj = signature as Record<string, unknown>;

    if (typeof obj.toUint8Array === "function") {
      return (obj.toUint8Array as () => Uint8Array)();
    }
    if (typeof obj.toBytes === "function") {
      return (obj.toBytes as () => Uint8Array)();
    }
    if (obj.data instanceof Uint8Array) return obj.data;
    if (typeof obj.hex === "string") return signatureToBytes(obj.hex);
    if (typeof obj.signature === "string" || obj.signature instanceof Uint8Array) {
      return signatureToBytes(obj.signature);
    }
    // BCS / nested wallet formats
    if (Array.isArray(obj.data)) {
      return new Uint8Array(obj.data as number[]);
    }
  }

  throw new Error("Unable to parse wallet signature bytes");
}

// ─── Low-level AES-GCM ───────────────────────────────────────────────────────

export function generateContentKey(): Uint8Array {
  const key = new Uint8Array(CONTENT_KEY_BYTES);
  crypto.getRandomValues(key);
  return key;
}

export function generateIv(): Uint8Array {
  const iv = new Uint8Array(AES_IV_BYTES);
  crypto.getRandomValues(iv);
  return iv;
}

async function importAesKey(
  rawKey: Uint8Array,
  usages: KeyUsage[]
): Promise<CryptoKey> {
  return getSubtle().importKey(
    "raw",
    rawKey as BufferSource,
    { name: "AES-GCM", length: AES_KEY_BITS },
    false,
    usages
  );
}

/**
 * Encrypt plaintext with AES-256-GCM.
 * Returns IV (12) || ciphertext+tag.
 */
export async function encryptAesGcm(
  plaintext: ArrayBuffer | Uint8Array,
  rawKey: Uint8Array,
  iv?: Uint8Array
): Promise<Uint8Array> {
  const ivBytes = iv ?? generateIv();
  if (ivBytes.length !== AES_IV_BYTES) {
    throw new Error(`AES-GCM IV must be ${AES_IV_BYTES} bytes`);
  }
  if (rawKey.length !== CONTENT_KEY_BYTES) {
    throw new Error(`AES-256 key must be ${CONTENT_KEY_BYTES} bytes`);
  }

  const key = await importAesKey(rawKey, ["encrypt"]);
  const data =
    plaintext instanceof Uint8Array
      ? (plaintext as BufferSource)
      : (new Uint8Array(plaintext) as BufferSource);

  const ct = await getSubtle().encrypt(
    { name: "AES-GCM", iv: ivBytes as BufferSource },
    key,
    data
  );

  return concatBytes(ivBytes, new Uint8Array(ct));
}

/**
 * Decrypt payload in format IV (12) || ciphertext+tag.
 */
export async function decryptAesGcm(
  payload: ArrayBuffer | Uint8Array,
  rawKey: Uint8Array
): Promise<Uint8Array> {
  const bytes =
    payload instanceof Uint8Array ? payload : new Uint8Array(payload);

  if (bytes.length < AES_IV_BYTES + 16) {
    throw new Error("Ciphertext too short, not valid AES-GCM payload");
  }
  if (rawKey.length !== CONTENT_KEY_BYTES) {
    throw new Error(`AES-256 key must be ${CONTENT_KEY_BYTES} bytes`);
  }

  const iv = bytes.subarray(0, AES_IV_BYTES);
  const ct = bytes.subarray(AES_IV_BYTES);
  const key = await importAesKey(rawKey, ["decrypt"]);

  try {
    const pt = await getSubtle().decrypt(
      { name: "AES-GCM", iv: iv as BufferSource },
      key,
      ct as BufferSource
    );
    return new Uint8Array(pt);
  } catch {
    throw new Error(
      "Decryption failed, wrong key, corrupted ciphertext, or unauthorized access"
    );
  }
}

// ─── Key wrap / unwrap ───────────────────────────────────────────────────────

/** Wrap a content key under another AES key (both 32-byte raw keys). */
export async function wrapKey(
  contentKey: Uint8Array,
  wrappingKey: Uint8Array
): Promise<string> {
  const wrapped = await encryptAesGcm(contentKey, wrappingKey);
  return bytesToBase64(wrapped);
}

export async function unwrapKey(
  wrappedKeyB64: string,
  wrappingKey: Uint8Array
): Promise<Uint8Array> {
  const payload = base64ToBytes(wrappedKeyB64);
  const unwrapped = await decryptAesGcm(payload, wrappingKey);
  if (unwrapped.length !== CONTENT_KEY_BYTES) {
    throw new Error("Unwrapped key has unexpected length");
  }
  return unwrapped;
}

// ─── Wallet-derived key (HKDF) ───────────────────────────────────────────────

/**
 * Derive a stable AES-256 key from an Aptos wallet message signature.
 * Call signMessage with FORGE_KEY_DERIVATION_MESSAGE + FORGE_KEY_DERIVATION_NONCE.
 */
export async function deriveKeyFromSignature(
  signature: unknown
): Promise<Uint8Array> {
  const ikm = signatureToBytes(signature);
  const subtle = getSubtle();

  const baseKey = await subtle.importKey("raw", ikm as BufferSource, "HKDF", false, [
    "deriveBits",
  ]);

  const bits = await subtle.deriveBits(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: HKDF_SALT as BufferSource,
      info: HKDF_INFO as BufferSource,
    },
    baseKey,
    AES_KEY_BITS
  );

  return new Uint8Array(bits);
}

/**
 * Request a deterministic signature from the connected Aptos wallet and
 * derive the owner AES key. User will see a sign-message prompt.
 */
export async function deriveOwnerKeyFromWallet(
  signMessage: WalletSignMessage
): Promise<Uint8Array> {
  if (!signMessage) {
    throw new Error("Wallet does not support signMessage");
  }

  const result = await signMessage({
    message: FORGE_KEY_DERIVATION_MESSAGE,
    nonce: FORGE_KEY_DERIVATION_NONCE,
    address: true,
  });

  if (!result?.signature) {
    throw new Error("Wallet did not return a signature for key derivation");
  }

  return deriveKeyFromSignature(result.signature);
}

// ─── High-level file encrypt / decrypt ───────────────────────────────────────

/**
 * Encrypt a File for Shelby upload.
 * Returns a ciphertext File + key material to store in MongoDB.
 */
export async function encryptFile(
  file: File,
  ownerWrappingKey: Uint8Array
): Promise<EncryptFileResult> {
  const contentKey = generateContentKey();
  const shareKey = generateContentKey();

  const plaintext = new Uint8Array(await file.arrayBuffer());
  const ciphertext = await encryptAesGcm(plaintext, contentKey);

  const wrappedKeyOwner = await wrapKey(contentKey, ownerWrappingKey);
  const wrappedKeyShare = await wrapKey(contentKey, shareKey);

  const encryptedFile = new File(
    [ciphertext as BlobPart],
    file.name.endsWith(".enc") ? file.name : `${file.name}.enc`,
    { type: "application/octet-stream", lastModified: file.lastModified }
  );

  const material: EncryptionMaterial = {
    isEncrypted: true,
    encryptionVersion: ENCRYPTION_VERSION,
    mimeType: file.type || "application/octet-stream",
    plaintextSize: file.size,
    wrappedKeyOwner,
    wrappedKeyShare,
    encryptionShareKey: bytesToBase64(shareKey),
  };

  return { encryptedFile, material, contentKey };
}

/**
 * Decrypt ciphertext bytes (IV||ct) given a raw content key.
 */
export async function decryptToBytes(
  ciphertext: ArrayBuffer | Uint8Array,
  contentKey: Uint8Array
): Promise<Uint8Array> {
  return decryptAesGcm(ciphertext, contentKey);
}

/**
 * Decrypt to a Blob with the original MIME type.
 */
export async function decryptToBlob(
  ciphertext: ArrayBuffer | Uint8Array,
  contentKey: Uint8Array,
  mimeType = "application/octet-stream"
): Promise<Blob> {
  const bytes = await decryptToBytes(ciphertext, contentKey);
  return new Blob([bytes as BlobPart], { type: mimeType });
}

/**
 * Resolve the content key from an authorized key package.
 * Prefers owner wallet path when wrappedKeyOwner + ownerKey are available;
 * otherwise uses share secret path.
 */
export async function resolveContentKey(
  pkg: AuthorizedKeyPackage,
  options?: {
    ownerKey?: Uint8Array;
    /** If true, try share path even when owner key is present (fallback). */
    preferShare?: boolean;
  }
): Promise<Uint8Array> {
  if (!pkg.isEncrypted) {
    throw new Error("Key package is not encrypted");
  }

  const tryOwner = async () => {
    if (!options?.ownerKey || !pkg.wrappedKeyOwner) {
      throw new Error("Owner key material unavailable");
    }
    return unwrapKey(pkg.wrappedKeyOwner, options.ownerKey);
  };

  const tryShare = async () => {
    if (!pkg.wrappedKeyShare || !pkg.encryptionShareKey) {
      throw new Error("Share key material unavailable, unlock may not be authorized");
    }
    const shareKey = base64ToBytes(pkg.encryptionShareKey);
    return unwrapKey(pkg.wrappedKeyShare, shareKey);
  };

  if (options?.preferShare) {
    try {
      return await tryShare();
    } catch {
      return tryOwner();
    }
  }

  if (options?.ownerKey && pkg.wrappedKeyOwner) {
    try {
      return await tryOwner();
    } catch {
      // Fall through to share path (e.g. owner viewing a re-wrapped package)
      return tryShare();
    }
  }

  return tryShare();
}

/**
 * Fetch ciphertext from a Shelby media URL and decrypt client-side.
 */
export async function fetchAndDecrypt(options: {
  ciphertextUrl: string;
  keyPackage: AuthorizedKeyPackage;
  ownerKey?: Uint8Array;
  preferShare?: boolean;
  signal?: AbortSignal;
}): Promise<{ blob: Blob; mimeType: string }> {
  const res = await fetch(options.ciphertextUrl, { signal: options.signal });
  if (!res.ok) {
    throw new Error(
      res.status === 403
        ? "Access denied while fetching encrypted media"
        : `Failed to fetch encrypted media (${res.status})`
    );
  }

  const ciphertext = new Uint8Array(await res.arrayBuffer());
  const contentKey = await resolveContentKey(options.keyPackage, {
    ownerKey: options.ownerKey,
    preferShare: options.preferShare,
  });

  const mimeType =
    options.keyPackage.mimeType || "application/octet-stream";
  const blob = await decryptToBlob(ciphertext, contentKey, mimeType);
  return { blob, mimeType };
}

/**
 * Trigger a browser download of a decrypted Blob.
 */
export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName || "download";
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoke after the browser has had time to start the download
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/** Strip sensitive key fields for public API responses. */
export function toPublicEncryptionFlags(
  record: {
    isEncrypted?: boolean | null;
    encryptionVersion?: number | null;
  } | null | undefined
): PublicEncryptionFlags {
  return {
    isEncrypted: !!record?.isEncrypted,
    encryptionVersion: record?.isEncrypted
      ? record.encryptionVersion ?? ENCRYPTION_VERSION
      : null,
  };
}

/**
 * Build authorized key package for a File / Asset DB record.
 * Call only after ownership / payment / unlock checks pass.
 */
export function toAuthorizedKeyPackage(
  record: {
    isEncrypted?: boolean | null;
    encryptionVersion?: number | null;
    wrappedKeyOwner?: string | null;
    wrappedKeyShare?: string | null;
    encryptionShareKey?: string | null;
    mimeType?: string | null;
    fileName?: string | null;
  },
  opts?: { includeOwnerWrap?: boolean }
): AuthorizedKeyPackage | { isEncrypted: false } {
  if (!record.isEncrypted) return { isEncrypted: false };

  return {
    isEncrypted: true,
    encryptionVersion: record.encryptionVersion ?? ENCRYPTION_VERSION,
    mimeType: record.mimeType,
    fileName: record.fileName,
    wrappedKeyOwner: opts?.includeOwnerWrap !== false ? record.wrappedKeyOwner : null,
    wrappedKeyShare: record.wrappedKeyShare,
    encryptionShareKey: record.encryptionShareKey,
  };
}

/** Prisma-friendly fields to persist on File / Asset create. */
export function encryptionFieldsForDb(material: EncryptionMaterial | null | undefined) {
  if (!material?.isEncrypted) {
    return {
      isEncrypted: false,
      encryptionVersion: null as number | null,
      wrappedKeyOwner: null as string | null,
      wrappedKeyShare: null as string | null,
      encryptionShareKey: null as string | null,
    };
  }
  return {
    isEncrypted: true,
    encryptionVersion: material.encryptionVersion,
    wrappedKeyOwner: material.wrappedKeyOwner,
    wrappedKeyShare: material.wrappedKeyShare,
    encryptionShareKey: material.encryptionShareKey,
  };
}
