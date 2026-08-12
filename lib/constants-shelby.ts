export const GATEWAY =
  process.env.NEXT_PUBLIC_SHELBY_GATEWAY || "https://forge-shelby-cdn.b-cdn.net/";

// Official Shelbynet endpoints after the Aug 2026 Public Testnet shutdown.
// The indexer still exposes a `blobs` root field, but columns were renamed
// (`blob_name` → `object_name`, `is_written` → `is_persisted`).
export const SHELBY_INDEXER_URL =
  process.env.NEXT_PUBLIC_SHELBY_INDEXER_URL ||
  "https://api.shelbynet.shelby.xyz/v1/graphql";
export const SHELBY_RPC_URL =
  process.env.NEXT_PUBLIC_SHELBY_RPC_URL ||
  "https://shelby.shelbynet.shelby.xyz/shelby";
export const SHELBY_LOCATION_HINT =
  process.env.NEXT_PUBLIC_SHELBY_LOCATION_HINT || "shelbynet-1";

// S3 Gateway for Shelby (S3-compatible). Previously used for Stream video uploads.
// Stream uploads now use the official Shelby SDK path (/api/upload/stream + uploadStreamVideo)
// via @shelby-protocol/sdk for registration + chunkset commit (recommended by Shelby Media Kit).
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
