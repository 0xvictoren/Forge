export const GATEWAY =
  process.env.NEXT_PUBLIC_SHELBY_GATEWAY || "https://forge-shelby-cdn.b-cdn.net/";

// S3 Gateway for Shelby (S3-compatible). Previously used for Stream video uploads.
// Stream uploads now use the official Shelby SDK path (/api/upload/stream + uploadStreamVideo)
// via @shelby-protocol/sdk for registration + resumable storage (recommended by Shelby Media Kit).
// These S3 vars are kept for backwards compatibility / other tools.
export const S3_ENDPOINT =
  process.env.S3_ENDPOINT || "https://forge-shelby-cdn.b-cdn.net/";
export const S3_REGION = process.env.S3_REGION || "us-east-1";
export const S3_ACCESS_KEY_ID = process.env.S3_ACCESS_KEY_ID || "";
export const S3_SECRET_ACCESS_KEY = process.env.S3_SECRET_ACCESS_KEY || "";
export const S3_BUCKET = process.env.S3_BUCKET || "forge-streams";

export const FEED_CATEGORIES = [
  "Graphic Design",
  "3D Art",
  "UI/UX",
  "Photography",
  "Motion Design",
  "Illustration",
  "Audio",
] as const;

export type FeedCategory = (typeof FEED_CATEGORIES)[number];
