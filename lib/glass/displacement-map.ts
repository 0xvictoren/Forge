/**
 * Liquid-glass displacement maps.
 *
 * Technique (after Aave's "Building glass for the web"): rather than sampling
 * what sits *behind* an element, we bend the element's own pixels - or, in
 * Chromium, the backdrop - with an SVG feDisplacementMap. The map is a small
 * image generated from the lens shape: red encodes horizontal displacement,
 * green vertical, 128 = neutral. Only the bezel (a band along the rim) bends;
 * the flat centre stays neutral so text underneath stays readable.
 *
 * The lens is a rounded rectangle, so only the top-left quadrant is computed
 * and mirrored into the other three with the matching axis negated - a quarter
 * of the per-pixel work. Maps are cached by shape, and regenerated only when
 * the shape changes, never when the lens moves.
 */

export type LensShape = {
  width: number;
  height: number;
  radius: number;
  /** Bezel width in px - how far in from the rim the surface curves. */
  depth: number;
  /** 0.5 (gentle, wide falloff) … 3 (tight, edge-only). */
  curvature: number;
};

const cache = new Map<string, string>();

function key(s: LensShape) {
  return `${Math.round(s.width)}x${Math.round(s.height)}r${Math.round(s.radius)}d${Math.round(s.depth)}c${s.curvature.toFixed(2)}`;
}

/** Distance into the shape from its rim, and the outward normal, for the top-left quadrant. */
function rimInfo(x: number, y: number, r: number): { d: number; nx: number; ny: number } {
  if (x < r && y < r) {
    const dx = x - r;
    const dy = y - r;
    const len = Math.hypot(dx, dy) || 1;
    return { d: r - len, nx: dx / len, ny: dy / len };
  }
  return x < y ? { d: x, nx: -1, ny: 0 } : { d: y, nx: 0, ny: -1 };
}

export function renderDisplacementMap(shape: LensShape): string | null {
  if (typeof document === "undefined") return null;
  const k = key(shape);
  const hit = cache.get(k);
  if (hit) return hit;

  const w = Math.max(2, Math.round(shape.width));
  const h = Math.max(2, Math.round(shape.height));
  const r = Math.max(0, Math.min(shape.radius, w / 2, h / 2));
  const depth = Math.max(1, Math.min(shape.depth, w / 2, h / 2));
  const exponent = Math.max(0.5, shape.curvature);

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  const img = ctx.createImageData(w, h);
  const data = img.data;

  // Neutral fill.
  for (let i = 0; i < data.length; i += 4) {
    data[i] = 128;
    data[i + 1] = 128;
    data[i + 2] = 128;
    data[i + 3] = 255;
  }

  const put = (px: number, py: number, rx: number, gy: number) => {
    if (px < 0 || py < 0 || px >= w || py >= h) return;
    const i = (py * w + px) * 4;
    data[i] = rx;
    data[i + 1] = gy;
  };

  const qw = Math.ceil(w / 2);
  const qh = Math.ceil(h / 2);
  for (let y = 0; y < qh; y++) {
    for (let x = 0; x < qw; x++) {
      const { d, nx, ny } = rimInfo(x + 0.5, y + 0.5, r);
      if (d < 0 || d >= depth) continue;
      // u: 0 at the rim → 1 at the inner edge of the bezel.
      const u = d / depth;
      const magnitude = Math.pow(1 - u, exponent);
      // Sample inward (towards the centre) - a convex lens magnifies the rim.
      const dx = -nx * magnitude;
      const dy = -ny * magnitude;
      const R = Math.round(128 + 127 * dx);
      const G = Math.round(128 + 127 * dy);
      const Rm = Math.round(128 - 127 * dx);
      const Gm = Math.round(128 - 127 * dy);
      put(x, y, R, G);
      put(w - 1 - x, y, Rm, G);
      put(x, h - 1 - y, R, Gm);
      put(w - 1 - x, h - 1 - y, Rm, Gm);
    }
  }

  ctx.putImageData(img, 0, 0);
  const url = canvas.toDataURL("image/png");
  if (cache.size > 64) cache.clear();
  cache.set(k, url);
  return url;
}

/** Chromium can apply SVG filters to the backdrop; Safari/Firefox cannot. */
export function supportsBackdropRefraction(): boolean {
  if (typeof window === "undefined") return false;
  const nav = navigator as Navigator & { userAgentData?: { brands?: { brand: string }[] } };
  const brands = nav.userAgentData?.brands?.map((b) => b.brand) ?? [];
  const chromium = brands.some((b) => /Chromium|Google Chrome|Microsoft Edge/.test(b));
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent);
  return chromium && !ios;
}

export function prefersReducedTransparency(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(prefers-reduced-transparency: reduce)").matches ||
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}
