/**
 * Pay-per-read pricing for agents. Prices are set per GB in APT and charged
 * per request in octas (1 APT = 1e8 octas), rounded up, with a minimum charge.
 */

export type ReadPricing = {
  enabled: boolean;
  /** Price for 1 GB (1e9 bytes) of delivered data, in APT. */
  pricePerGbApt: number;
  /** Floor per request, in APT, so tiny range reads still pay something. */
  minChargeApt: number;
};

export const OCTAS_PER_APT = BigInt(100_000_000);
export const DEFAULT_READ_PRICING: ReadPricing = { enabled: false, pricePerGbApt: 1, minChargeApt: 0.0001 };

export function parseReadPricing(value: unknown): ReadPricing {
  if (!value || typeof value !== "object") return { ...DEFAULT_READ_PRICING };
  const v = value as Partial<ReadPricing>;
  const num = (x: unknown, fallback: number, max: number) => {
    const n = Number(x);
    return Number.isFinite(n) && n >= 0 && n <= max ? n : fallback;
  };
  return {
    enabled: !!v.enabled,
    pricePerGbApt: num(v.pricePerGbApt, DEFAULT_READ_PRICING.pricePerGbApt, 1_000_000),
    minChargeApt: num(v.minChargeApt, DEFAULT_READ_PRICING.minChargeApt, 1_000),
  };
}

export function aptToOctasBig(apt: number): bigint {
  // Avoid float drift: work in fixed 8-decimal strings.
  const [whole, frac = ""] = apt.toFixed(8).split(".");
  return BigInt(whole) * OCTAS_PER_APT + BigInt(frac.padEnd(8, "0").slice(0, 8));
}

export function octasToAptString(octas: bigint | string, digits = 8): string {
  const o = typeof octas === "string" ? BigInt(octas) : octas;
  const neg = o < BigInt(0);
  const abs = neg ? -o : o;
  const whole = abs / OCTAS_PER_APT;
  const frac = (abs % OCTAS_PER_APT).toString().padStart(8, "0").slice(0, digits).replace(/0+$/, "");
  return `${neg ? "-" : ""}${whole}${frac ? `.${frac}` : ""}`;
}

/** Price in octas for delivering `bytes` bytes. */
export function quoteReadOctas(bytes: number, pricing: ReadPricing): bigint {
  const perGb = aptToOctasBig(pricing.pricePerGbApt);
  const min = aptToOctasBig(pricing.minChargeApt);
  const b = BigInt(Math.max(0, Math.ceil(bytes)));
  const GB = BigInt(1_000_000_000);
  const raw = (b * perGb + GB - BigInt(1)) / GB;
  return raw > min ? raw : min;
}

/** Parse a single `Range: bytes=a-b` header against a file size. */
export function parseRange(header: string | null, size: number): { start: number; end: number } | null | "invalid" {
  if (!header) return null;
  const m = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!m || (m[1] === "" && m[2] === "")) return "invalid";
  let start: number;
  let end: number;
  if (m[1] === "") {
    const suffix = Number(m[2]);
    start = Math.max(0, size - suffix);
    end = size - 1;
  } else {
    start = Number(m[1]);
    end = m[2] === "" ? size - 1 : Math.min(Number(m[2]), size - 1);
  }
  if (!Number.isFinite(start) || !Number.isFinite(end) || start > end || start >= size) return "invalid";
  return { start, end };
}
