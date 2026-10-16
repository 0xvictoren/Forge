import { bytesToHex, hexToBytes, hmacSha256 } from "./hash";

/**
 * Per-buyer fingerprinting for text-based dataset formats.
 *
 * Two independent marks are applied to every delivered copy:
 *  1. Canary records: a few realistic-looking records derived from real rows,
 *     with numeric fields nudged by amounts only the license seed can reproduce.
 *     They are inserted at seed-derived positions. They survive re-saving and
 *     reformatting, and a model trained on the copy tends to memorise them.
 *  2. Invisible signature: the license fingerprint id, encoded in zero-width
 *     characters inside text fields / lines. It decodes straight to a license,
 *     without needing the original file.
 *
 * Binary formats (video, images, audio, archives) are delivered unchanged in the
 * MVP; per-segment A/B watermarking for video is planned once chunked storage
 * for media lands.
 */

export type FingerprintFormat = "csv" | "tsv" | "jsonl" | "json" | "text" | "binary";

export type FingerprintContext = {
  /** Secret per-license seed (hex). Never shown to buyers. */
  seedHex: string;
  /** Public per-license id (16 hex chars) embedded in the invisible signature. */
  fingerprintId: string;
  /** File identity, so each file in a dataset gets different canaries. */
  fileId: string;
};

export type FingerprintResult = {
  text: string;
  canaries: string[];
  format: FingerprintFormat;
};

const ZW0 = "​";
const ZW1 = "‌";
const ZW_START = "⁠";
const ZW_END = "⁣";

export function detectFingerprintFormat(fileName: string, mimeType?: string | null): FingerprintFormat {
  const name = fileName.toLowerCase();
  const mime = (mimeType || "").toLowerCase();
  if (name.endsWith(".csv") || mime === "text/csv") return "csv";
  if (name.endsWith(".tsv") || mime === "text/tab-separated-values") return "tsv";
  if (name.endsWith(".jsonl") || name.endsWith(".ndjson") || mime === "application/x-ndjson" || mime === "application/jsonl") {
    return "jsonl";
  }
  if (name.endsWith(".json") || mime === "application/json") return "json";
  if (/\.(txt|md|markdown|text|srt|vtt)$/.test(name) || mime.startsWith("text/")) return "text";
  return "binary";
}

export function encodeSignature(fingerprintId: string): string {
  const bytes = hexToBytes(fingerprintId);
  let bits = "";
  for (const b of bytes) for (let i = 7; i >= 0; i--) bits += (b >> i) & 1 ? ZW1 : ZW0;
  return `${ZW_START}${bits}${ZW_END}`;
}

/** Find every invisible signature in a text and return the decoded fingerprint ids with counts. */
export function decodeSignatures(text: string): Map<string, number> {
  const found = new Map<string, number>();
  const re = new RegExp(`${ZW_START}([${ZW0}${ZW1}]{8,512})${ZW_END}`, "g");
  for (const match of text.matchAll(re)) {
    const bits = match[1];
    if (bits.length % 8 !== 0) continue;
    const bytes = new Uint8Array(bits.length / 8);
    for (let i = 0; i < bytes.length; i++) {
      let v = 0;
      for (let j = 0; j < 8; j++) v = (v << 1) | (bits[i * 8 + j] === ZW1 ? 1 : 0);
      bytes[i] = v;
    }
    const id = bytesToHex(bytes);
    found.set(id, (found.get(id) || 0) + 1);
  }
  return found;
}

export function stripSignatures(text: string): string {
  return text.replace(new RegExp(`${ZW_START}[${ZW0}${ZW1}]*${ZW_END}`, "g"), "");
}

/** Deterministic pseudo-random stream keyed by the license seed. */
class SeededStream {
  private pool: number[] = [];
  private counter = 0;
  constructor(private seed: Uint8Array, private label: string) {}
  async next(): Promise<number> {
    if (!this.pool.length) {
      const block = await hmacSha256(this.seed, `${this.label}:${this.counter++}`);
      for (let i = 0; i < block.length; i += 4) {
        this.pool.push(((block[i] << 24) | (block[i + 1] << 16) | (block[i + 2] << 8) | block[i + 3]) >>> 0);
      }
    }
    return this.pool.shift()!;
  }
  async int(maxExclusive: number): Promise<number> {
    if (maxExclusive <= 1) return 0;
    return (await this.next()) % maxExclusive;
  }
}

export function canaryCountFor(rows: number): number {
  if (rows < 20) return rows >= 2 ? 1 : 0;
  return Math.min(25, Math.max(3, Math.ceil(rows * 0.001)));
}

const NUMERIC = /^-?\d+(\.\d+)?$/;

async function perturbNumber(value: string, rng: SeededStream): Promise<string> {
  const negative = value.startsWith("-");
  const [intPart, frac] = value.replace("-", "").split(".");
  const delta = 1 + (await rng.int(3));
  const up = (await rng.int(2)) === 1;
  if (frac !== undefined) {
    const scaled = BigInt(intPart + frac);
    let next = up ? scaled + BigInt(delta) : scaled - BigInt(delta);
    if (next < BigInt(0)) next = scaled + BigInt(delta);
    const digits = next.toString().padStart(frac.length + 1, "0");
    return `${negative ? "-" : ""}${digits.slice(0, -frac.length)}.${digits.slice(-frac.length)}`;
  }
  let n = BigInt(intPart);
  n = up || n < BigInt(delta) ? n + BigInt(delta) : n - BigInt(delta);
  return `${negative ? "-" : ""}${n.toString()}`;
}

function insertSignature(value: string, signature: string): string {
  if (!value) return signature;
  const space = value.indexOf(" ");
  const at = space > 0 ? space : Math.min(value.length, Math.max(1, Math.floor(value.length / 2)));
  return value.slice(0, at) + signature + value.slice(at);
}

// ─── Delimited (CSV / TSV) ───────────────────────────────────────────────────

export function parseDelimited(text: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += c;
      continue;
    }
    if (c === '"' && field === "") quoted = true;
    else if (c === delimiter) {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += c;
  }
  if (field !== "" || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

export function serializeDelimited(rows: string[][], delimiter: string, eol = "\n"): string {
  const esc = (v: string) =>
    v.includes(delimiter) || v.includes('"') || v.includes("\n") || v.includes("\r") ? `"${v.replace(/"/g, '""')}"` : v;
  return rows.map((r) => r.map(esc).join(delimiter)).join(eol);
}

async function canaryFromRow(
  row: string[],
  rng: SeededStream,
  signature: string
): Promise<{ row: string[]; distinct: boolean }> {
  const out = [...row];
  let changed = false;
  let distinct = false;
  for (let i = 0; i < out.length; i++) {
    if (NUMERIC.test(out[i])) {
      out[i] = await perturbNumber(out[i], rng);
      changed = true;
      distinct = true;
    }
  }
  let longest = -1;
  for (let i = 0; i < out.length; i++) {
    if (!NUMERIC.test(out[i]) && out[i].length > (longest >= 0 ? out[longest].length : 0)) longest = i;
  }
  if (longest >= 0) {
    out[longest] = insertSignature(out[longest], signature);
    changed = true;
  }
  if (!changed && out.length) out[0] = insertSignature(out[0], signature);
  return { row: out, distinct };
}

async function fingerprintDelimited(text: string, delimiter: string, ctx: FingerprintContext): Promise<{ text: string; canaries: string[] }> {
  const eol = text.includes("\r\n") ? "\r\n" : "\n";
  const trailing = text.endsWith("\n");
  const rows = parseDelimited(trailing ? text.replace(/\r?\n$/, "") : text, delimiter);
  if (rows.length < 3) return { text, canaries: [] };
  const [header, ...data] = rows;
  const rng = new SeededStream(hexToBytes(ctx.seedHex), `delim:${ctx.fileId}`);
  const signature = encodeSignature(ctx.fingerprintId);
  const count = canaryCountFor(data.length);
  const canaries: { row: string[]; distinct: boolean }[] = [];
  for (let i = 0; i < count; i++) {
    const source = data[await rng.int(data.length)];
    canaries.push(await canaryFromRow(source, rng, signature));
  }
  const output = [...data];
  for (const canary of canaries) output.splice(await rng.int(output.length + 1), 0, canary.row);
  const body = serializeDelimited([header, ...output], delimiter, eol);
  return {
    text: trailing ? body + eol : body,
    // Only canaries whose values differ from their source row can identify a
    // copy once the invisible signature has been stripped.
    canaries: canaries.filter((c) => c.distinct).map((c) => serializeDelimited([c.row], delimiter)),
  };
}

// ─── JSON / JSON Lines ───────────────────────────────────────────────────────

async function perturbJson(value: unknown, rng: SeededStream): Promise<unknown> {
  if (typeof value === "number" && Number.isFinite(value)) {
    const s = String(value);
    if (NUMERIC.test(s)) return Number(await perturbNumber(s, rng));
    return value;
  }
  if (Array.isArray(value)) {
    const out = [];
    for (const v of value) out.push(await perturbJson(v, rng));
    return out;
  }
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) out[k] = await perturbJson(v, rng);
    return out;
  }
  return value;
}

function signLongestString(value: unknown, signature: string): { value: unknown; signed: boolean } {
  let bestPath: (string | number)[] | null = null;
  let bestLen = -1;
  const walk = (v: unknown, path: (string | number)[]) => {
    if (typeof v === "string" && v.length > bestLen) {
      bestLen = v.length;
      bestPath = path;
    } else if (Array.isArray(v)) v.forEach((x, i) => walk(x, [...path, i]));
    else if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) walk(x, [...path, k]);
  };
  walk(value, []);
  if (!bestPath) return { value, signed: false };
  if ((bestPath as (string | number)[]).length === 0) return { value: insertSignature(value as string, signature), signed: true };
  const clone = structuredClone(value) as Record<string | number, unknown>;
  let cursor: Record<string | number, unknown> = clone;
  const path = bestPath as (string | number)[];
  for (let i = 0; i < path.length - 1; i++) cursor = cursor[path[i]] as Record<string | number, unknown>;
  const last = path[path.length - 1];
  cursor[last] = insertSignature(cursor[last] as string, signature);
  return { value: clone, signed: true };
}

async function fingerprintRecords(records: unknown[], ctx: FingerprintContext, label: string) {
  const rng = new SeededStream(hexToBytes(ctx.seedHex), `${label}:${ctx.fileId}`);
  const signature = encodeSignature(ctx.fingerprintId);
  const count = canaryCountFor(records.length);
  const canaries: { value: unknown; distinct: boolean }[] = [];
  for (let i = 0; i < count; i++) {
    const source = records[await rng.int(records.length)];
    const perturbed = await perturbJson(source, rng);
    canaries.push({
      value: signLongestString(perturbed, signature).value,
      distinct: JSON.stringify(perturbed) !== JSON.stringify(source),
    });
  }
  const output = [...records];
  for (const canary of canaries) output.splice(await rng.int(output.length + 1), 0, canary.value);
  return { output, canaries: canaries.filter((c) => c.distinct).map((c) => JSON.stringify(c.value)) };
}

async function fingerprintJsonl(text: string, ctx: FingerprintContext) {
  const eol = text.includes("\r\n") ? "\r\n" : "\n";
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  const records: unknown[] = [];
  for (const line of lines) {
    try {
      records.push(JSON.parse(line));
    } catch {
      return fingerprintText(text, ctx);
    }
  }
  if (records.length < 2) return { text, canaries: [] };
  const { output, canaries } = await fingerprintRecords(records, ctx, "jsonl");
  return { text: output.map((r) => JSON.stringify(r)).join(eol) + (text.endsWith("\n") ? eol : ""), canaries };
}

async function fingerprintJson(text: string, ctx: FingerprintContext) {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return fingerprintText(text, ctx);
  }
  if (Array.isArray(parsed) && parsed.length >= 2) {
    const { output, canaries } = await fingerprintRecords(parsed, ctx, "json");
    return { text: JSON.stringify(output, null, text.includes("\n  ") ? 2 : undefined), canaries };
  }
  const signed = signLongestString(parsed, encodeSignature(ctx.fingerprintId));
  return { text: JSON.stringify(signed.value, null, text.includes("\n  ") ? 2 : undefined), canaries: [] };
}

// ─── Plain text ──────────────────────────────────────────────────────────────

async function fingerprintText(text: string, ctx: FingerprintContext) {
  const lines = text.split("\n");
  const rng = new SeededStream(hexToBytes(ctx.seedHex), `text:${ctx.fileId}`);
  const signature = encodeSignature(ctx.fingerprintId);
  const candidates = lines.map((l, i) => (l.trim().length > 12 ? i : -1)).filter((i) => i >= 0);
  if (!candidates.length) return { text: insertSignature(text, signature), canaries: [] };
  const marks = Math.min(candidates.length, Math.max(1, Math.ceil(candidates.length / 200)));
  for (let i = 0; i < marks; i++) {
    const idx = candidates[await rng.int(candidates.length)];
    if (!lines[idx].includes(ZW_START)) lines[idx] = insertSignature(lines[idx], signature);
  }
  return { text: lines.join("\n"), canaries: [] };
}

export async function fingerprintContent(
  text: string,
  format: FingerprintFormat,
  ctx: FingerprintContext
): Promise<FingerprintResult> {
  if (!/^[0-9a-f]{16}$/.test(ctx.fingerprintId)) throw new Error("fingerprintId must be 16 hex characters");
  switch (format) {
    case "csv":
      return { ...(await fingerprintDelimited(text, ",", ctx)), format };
    case "tsv":
      return { ...(await fingerprintDelimited(text, "\t", ctx)), format };
    case "jsonl":
      return { ...(await fingerprintJsonl(text, ctx)), format };
    case "json":
      return { ...(await fingerprintJson(text, ctx)), format };
    case "text":
      return { ...(await fingerprintText(text, ctx)), format };
    default:
      return { text, canaries: [], format };
  }
}

export type TraceCandidate = { licenseId: string; fingerprintId: string; canaries: string[] };

export type TraceMatch = {
  licenseId: string;
  fingerprintId: string;
  signatureHits: number;
  canaryHits: number;
  canaryTotal: number;
  confidence: "conclusive" | "strong" | "weak";
};

/**
 * Compare a suspected leak against every license's marks.
 * Canaries are compared with signatures stripped, so a leaker who removes
 * zero-width characters is still caught by the perturbed values.
 */
export function traceLeak(suspect: string, candidates: TraceCandidate[]): TraceMatch[] {
  const signatures = decodeSignatures(suspect);
  let plain = stripSignatures(suspect);
  // Pretty-printed JSON arrays: also search the compact form of each element.
  try {
    const parsed = JSON.parse(plain);
    if (Array.isArray(parsed)) plain += "\n" + parsed.map((r) => JSON.stringify(r)).join("\n");
  } catch {
    /* not a JSON document */
  }
  const matches: TraceMatch[] = [];
  for (const c of candidates) {
    const signatureHits = signatures.get(c.fingerprintId) || 0;
    const canaryHits = c.canaries.filter((row) => {
      const stripped = stripSignatures(row).trim();
      return stripped.length > 0 && plain.includes(stripped);
    }).length;
    if (!signatureHits && !canaryHits) continue;
    const ratio = c.canaries.length ? canaryHits / c.canaries.length : 0;
    const confidence: TraceMatch["confidence"] =
      signatureHits > 0 && canaryHits > 0 ? "conclusive" : signatureHits > 0 || ratio >= 0.5 ? "strong" : "weak";
    matches.push({ licenseId: c.licenseId, fingerprintId: c.fingerprintId, signatureHits, canaryHits, canaryTotal: c.canaries.length, confidence });
  }
  const rank = { conclusive: 0, strong: 1, weak: 2 };
  return matches.sort((a, b) => rank[a.confidence] - rank[b.confidence] || b.canaryHits - a.canaryHits);
}
