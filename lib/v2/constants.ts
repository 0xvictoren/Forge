export const ASSET_TYPES = [
  "PDF",
  "ZIP",
  "VIDEO",
  "IMAGE",
  "AUDIO",
  "COURSE",
  "TEMPLATE",
  "CODE",
  "DOCUMENT",
  "BUNDLE",
  "OTHER",
] as const;

export const VAULT_TYPES = [
  "PRIVATE",
  "CREATOR",
  "SUBSCRIPTION",
  "COURSE",
  "TEAM",
  "CLIENT",
] as const;

export const VAULT_ROLES = [
  "OWNER",
  "ADMIN",
  "EDITOR",
  "VIEWER",
  "SUBSCRIBER",
  "PURCHASER",
] as const;

export const PRODUCT_TYPES = [
  "ASSET",
  "BUNDLE",
  "VAULT_ACCESS",
  "SUBSCRIPTION",
  "WORKSPACE",
  "SERVICE",
] as const;

export const EXPLORE_CATEGORIES = [
  "all",
  "templates",
  "courses",
  "graphics",
  "code",
  "music",
  "research",
  "prompts",
  "bundles",
] as const;

/** Asset type filters shown on Explore */
export const EXPLORE_ASSET_TYPES = [
  { value: "all", label: "All types" },
  { value: "PDF", label: "PDF" },
  { value: "VIDEO", label: "Video" },
  { value: "AUDIO", label: "Audio" },
  { value: "ZIP", label: "Pack" },
  { value: "CODE", label: "Code" },
  { value: "BUNDLE", label: "Bundle" },
  { value: "IMAGE", label: "Image" },
  { value: "OTHER", label: "Other" },
] as const;

export const EXPLORE_SORT_OPTIONS = [
  { value: "recent", label: "Newest" },
  { value: "popular", label: "Trending" },
  { value: "views", label: "Most viewed" },
  { value: "price_asc", label: "Price: low to high" },
  { value: "price_desc", label: "Price: high to low" },
] as const;

export const REPUTATION_LEVELS = [
  { level: "Bronze", min: 0 },
  { level: "Silver", min: 100 },
  { level: "Gold", min: 500 },
  { level: "Platinum", min: 2000 },
  { level: "Elite", min: 10000 },
] as const;

export function reputationLevelFromScore(score: number): string {
  let level = "Bronze";
  for (const tier of REPUTATION_LEVELS) {
    if (score >= tier.min) level = tier.level;
  }
  return level;
}

export function inferAssetType(mimeType?: string | null, fileName?: string | null): string {
  const mime = (mimeType || "").toLowerCase();
  const ext = (fileName || "").split(".").pop()?.toLowerCase() || "";
  if (mime.startsWith("video/") || ["mp4", "webm", "mov"].includes(ext)) return "VIDEO";
  if (mime.startsWith("image/")) return "IMAGE";
  if (mime.startsWith("audio/")) return "AUDIO";
  if (mime === "application/pdf" || ext === "pdf") return "PDF";
  if (mime.includes("zip") || ext === "zip") return "ZIP";
  if (["js", "ts", "tsx", "py", "rs", "go", "java"].includes(ext)) return "CODE";
  return "OTHER";
}
