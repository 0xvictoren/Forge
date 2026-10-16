export const MODALITIES = [
  { id: "VIDEO", label: "Video" },
  { id: "ROBOTICS", label: "Robotics" },
  { id: "IMAGE", label: "Images" },
  { id: "AUDIO", label: "Audio & speech" },
  { id: "TEXT", label: "Text" },
  { id: "TABULAR", label: "Tabular" },
  { id: "SENSOR", label: "Sensor & telemetry" },
  { id: "GEOSPATIAL", label: "Geospatial" },
  { id: "MULTIMODAL", label: "Multimodal" },
] as const;

export type Modality = (typeof MODALITIES)[number]["id"];

export function isModality(value: unknown): value is Modality {
  return MODALITIES.some((m) => m.id === value);
}

export function modalityLabel(id: string): string {
  return MODALITIES.find((m) => m.id === id)?.label ?? id;
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB", "PB"];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  const v = bytes / 1024 ** i;
  return `${v >= 100 || i === 0 ? v.toFixed(0) : v.toFixed(1)} ${units[i]}`;
}

export function shortHash(hash: string | null | undefined, size = 6): string {
  if (!hash) return "None";
  const h = hash.startsWith("0x") ? hash.slice(2) : hash;
  return `0x${h.slice(0, size)}…${h.slice(-4)}`;
}

/** Cover images are rendered through next/image, so only configured hosts are accepted. */
export function isAllowedCoverUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return (
      u.protocol === "https:" &&
      (u.hostname === "images.unsplash.com" ||
        u.hostname === "gateway.shelby.network" ||
        u.hostname.endsWith(".shelby.xyz") ||
        u.hostname.endsWith(".b-cdn.net"))
    );
  } catch {
    return false;
  }
}
