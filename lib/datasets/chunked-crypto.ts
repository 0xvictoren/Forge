/**
 * Chunked AES-256-GCM ("FGC2") for dataset files of any size.
 *
 * Layout: MAGIC "FGC2" (4) | version u8 (1) | chunkSize u32 BE (4) | ivPrefix (8)
 *         | chunk_0 ciphertext+tag | chunk_1 … | chunk_n (last)
 *
 * Each chunk i uses IV = ivPrefix || u32 BE(i) and AAD = "FGC2" || u32(i) || u8(isLast).
 * Binding the index and the last-chunk flag into the AAD means chunks cannot be
 * reordered, dropped, or the stream truncated without decryption failing.
 *
 * Works in browsers and Node 20+ (Web Crypto). Content keys are wrapped with the
 * existing helpers in lib/encryption.ts, so key release stays unchanged.
 */

export const FGC2_MAGIC = new Uint8Array([0x46, 0x47, 0x43, 0x32]);
export const FGC2_VERSION = 2;
export const FGC2_HEADER_BYTES = 17;
export const DEFAULT_CHUNK_SIZE = 8 * 1024 * 1024;
const TAG_BYTES = 16;

function subtle(): SubtleCrypto {
  const c = globalThis.crypto;
  if (!c?.subtle) throw new Error("Web Crypto is not available");
  return c.subtle;
}

function u32(n: number): Uint8Array {
  const b = new Uint8Array(4);
  new DataView(b.buffer).setUint32(0, n, false);
  return b;
}

function chunkIv(prefix: Uint8Array, index: number): Uint8Array {
  const iv = new Uint8Array(12);
  iv.set(prefix, 0);
  iv.set(u32(index), 8);
  return iv;
}

function chunkAad(index: number, isLast: boolean): Uint8Array {
  const aad = new Uint8Array(9);
  aad.set(FGC2_MAGIC, 0);
  aad.set(u32(index), 4);
  aad[8] = isLast ? 1 : 0;
  return aad;
}

async function importKey(raw: Uint8Array, usage: KeyUsage[]) {
  if (raw.byteLength !== 32) throw new Error("Content key must be 256 bits");
  return subtle().importKey("raw", raw as BufferSource, { name: "AES-GCM" }, false, usage);
}

export function isFgc2(header: Uint8Array): boolean {
  return header.byteLength >= 4 && FGC2_MAGIC.every((b, i) => header[i] === b);
}

export function encryptedSizeFor(plaintextSize: number, chunkSize = DEFAULT_CHUNK_SIZE): number {
  const chunks = Math.max(1, Math.ceil(plaintextSize / chunkSize));
  return FGC2_HEADER_BYTES + plaintextSize + chunks * TAG_BYTES;
}

/**
 * Encrypt a Blob/File chunk by chunk. Returns a Blob whose parts are the
 * encrypted chunks, so the browser can keep them off the JS heap.
 */
export async function encryptBlobChunked(
  input: Blob,
  contentKey: Uint8Array,
  options?: { chunkSize?: number; onProgress?: (fraction: number) => void }
): Promise<Blob> {
  const chunkSize = options?.chunkSize ?? DEFAULT_CHUNK_SIZE;
  const key = await importKey(contentKey, ["encrypt"]);
  const prefix = globalThis.crypto.getRandomValues(new Uint8Array(8));

  const header = new Uint8Array(FGC2_HEADER_BYTES);
  header.set(FGC2_MAGIC, 0);
  header[4] = FGC2_VERSION;
  header.set(u32(chunkSize), 5);
  header.set(prefix, 9);

  const parts: BlobPart[] = [header as BlobPart];
  const total = Math.max(1, Math.ceil(input.size / chunkSize));
  for (let i = 0; i < total; i++) {
    const plain = new Uint8Array(await input.slice(i * chunkSize, (i + 1) * chunkSize).arrayBuffer());
    const isLast = i === total - 1;
    const ct = await subtle().encrypt(
      { name: "AES-GCM", iv: chunkIv(prefix, i) as BufferSource, additionalData: chunkAad(i, isLast) as BufferSource },
      key,
      plain as BufferSource
    );
    parts.push(new Uint8Array(ct) as BlobPart);
    options?.onProgress?.((i + 1) / total);
  }
  return new Blob(parts, { type: "application/octet-stream" });
}

/** Decrypt a full FGC2 buffer in memory (server-side delivery, small/medium files). */
export async function decryptBufferChunked(data: Uint8Array, contentKey: Uint8Array): Promise<Uint8Array> {
  if (data.byteLength < FGC2_HEADER_BYTES + TAG_BYTES) throw new Error("Encrypted file is truncated");
  if (!isFgc2(data) || data[4] !== FGC2_VERSION) throw new Error("Not an FGC2 encrypted file");
  const chunkSize = new DataView(data.buffer, data.byteOffset + 5, 4).getUint32(0, false);
  if (chunkSize <= 0) throw new Error("Invalid chunk size");
  const prefix = data.slice(9, 17);
  const key = await importKey(contentKey, ["decrypt"]);
  const body = data.subarray(FGC2_HEADER_BYTES);
  const encChunk = chunkSize + TAG_BYTES;
  const total = Math.max(1, Math.ceil(body.byteLength / encChunk));
  const result = new Uint8Array(body.byteLength - total * TAG_BYTES);
  let pos = 0;
  for (let i = 0; i < total; i++) {
    const ct = body.subarray(i * encChunk, (i + 1) * encChunk);
    const plain = await subtle().decrypt(
      { name: "AES-GCM", iv: chunkIv(prefix, i) as BufferSource, additionalData: chunkAad(i, i === total - 1) as BufferSource },
      key,
      ct as BufferSource
    );
    result.set(new Uint8Array(plain), pos);
    pos += plain.byteLength;
  }
  return result;
}

/**
 * Streaming decryptor. Pipe ciphertext bytes in, plaintext comes out.
 * The last chunk is only known when the input ends, so one encrypted chunk is
 * buffered before it is decrypted.
 */
export function decryptStreamChunked(contentKey: Uint8Array): TransformStream<Uint8Array, Uint8Array> {
  let keyPromise: Promise<CryptoKey> | null = null;
  let buffer = new Uint8Array(0);
  let headerParsed = false;
  let chunkSize = 0;
  let prefix = new Uint8Array(8);
  let index = 0;

  const append = (data: Uint8Array) => {
    const next = new Uint8Array(buffer.byteLength + data.byteLength);
    next.set(buffer, 0);
    next.set(data, buffer.byteLength);
    buffer = next;
  };

  const decryptChunk = async (ct: Uint8Array, isLast: boolean) => {
    keyPromise ??= importKey(contentKey, ["decrypt"]);
    const plain = await subtle().decrypt(
      { name: "AES-GCM", iv: chunkIv(prefix, index) as BufferSource, additionalData: chunkAad(index, isLast) as BufferSource },
      await keyPromise,
      ct as BufferSource
    );
    index++;
    return new Uint8Array(plain);
  };

  return new TransformStream<Uint8Array, Uint8Array>({
    async transform(data, controller) {
      append(data);
      if (!headerParsed) {
        if (buffer.byteLength < FGC2_HEADER_BYTES) return;
        if (!isFgc2(buffer) || buffer[4] !== FGC2_VERSION) throw new Error("Not an FGC2 encrypted file");
        chunkSize = new DataView(buffer.buffer, buffer.byteOffset + 5, 4).getUint32(0, false);
        prefix = buffer.slice(9, 17);
        buffer = buffer.slice(FGC2_HEADER_BYTES);
        headerParsed = true;
      }
      const encChunk = chunkSize + TAG_BYTES;
      // Keep at least one full chunk buffered: it may be the last one.
      while (buffer.byteLength > encChunk) {
        const ct = buffer.slice(0, encChunk);
        buffer = buffer.slice(encChunk);
        controller.enqueue(await decryptChunk(ct, false));
      }
    },
    async flush(controller) {
      if (!headerParsed) throw new Error("Encrypted file is truncated");
      if (buffer.byteLength < TAG_BYTES) throw new Error("Encrypted file is truncated");
      controller.enqueue(await decryptChunk(buffer, true));
    },
  });
}
