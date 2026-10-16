/**
 * Isomorphic hashing + canonical JSON helpers (browser Web Crypto and Node 20+).
 * Everything that is sealed onchain must be hashed through `canonicalJson`
 * so the same logical object always produces the same digest.
 */

function subtle(): SubtleCrypto {
  const c = globalThis.crypto;
  if (!c?.subtle) throw new Error("Web Crypto is not available in this environment");
  return c.subtle;
}

export function bytesToHex(bytes: Uint8Array): string {
  let out = "";
  for (let i = 0; i < bytes.length; i++) out += bytes[i].toString(16).padStart(2, "0");
  return out;
}

export function hexToBytes(hex: string): Uint8Array {
  const clean = hex.startsWith("0x") ? hex.slice(2) : hex;
  if (clean.length % 2 !== 0 || !/^[0-9a-f]*$/i.test(clean)) throw new Error("Invalid hex string");
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  return out;
}

export async function sha256Hex(data: Uint8Array | ArrayBuffer | string): Promise<string> {
  const bytes =
    typeof data === "string"
      ? new TextEncoder().encode(data)
      : data instanceof Uint8Array
        ? data
        : new Uint8Array(data);
  const digest = await subtle().digest("SHA-256", bytes as BufferSource);
  return bytesToHex(new Uint8Array(digest));
}

export async function hmacSha256(key: Uint8Array | string, message: string): Promise<Uint8Array> {
  const raw = typeof key === "string" ? new TextEncoder().encode(key) : key;
  const k = await subtle().importKey("raw", raw as BufferSource, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await subtle().sign("HMAC", k, new TextEncoder().encode(message) as BufferSource);
  return new Uint8Array(sig);
}

/** Deterministic JSON: sorted object keys, no whitespace, undefined dropped. */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") {
    if (typeof value === "number" && !Number.isFinite(value)) throw new Error("Non-finite number in canonical JSON");
    return JSON.stringify(value ?? null);
  }
  if (Array.isArray(value)) return `[${value.map((v) => canonicalJson(v === undefined ? null : v)).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(",")}}`;
}

/** Hash a File/Blob in slices so large files never need one giant ArrayBuffer for reading. */
export async function sha256File(file: Blob, onProgress?: (fraction: number) => void): Promise<string> {
  // Web Crypto has no incremental digest; for files up to a few GB a single
  // digest over the full buffer is the portable option. We still read in
  // slices to report progress and keep peak copies to one.
  const SLICE = 16 * 1024 * 1024;
  const parts: Uint8Array[] = [];
  let read = 0;
  for (let offset = 0; offset < file.size; offset += SLICE) {
    const chunk = new Uint8Array(await file.slice(offset, offset + SLICE).arrayBuffer());
    parts.push(chunk);
    read += chunk.byteLength;
    onProgress?.(file.size ? read / file.size : 1);
  }
  const all = new Uint8Array(read);
  let pos = 0;
  for (const p of parts) {
    all.set(p, pos);
    pos += p.byteLength;
  }
  return sha256Hex(all);
}
