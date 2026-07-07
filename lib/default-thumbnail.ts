import { getShelbyPublicUrl } from "@/lib/shelby-public";

export const DEFAULT_THUMBNAIL_URL = "/orange.webp";

export function resolveThumbnailUrl(thumbnailRef?: string | null): string {
  if (thumbnailRef) return getShelbyPublicUrl(thumbnailRef);
  return DEFAULT_THUMBNAIL_URL;
}