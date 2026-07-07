import { getShelbyPublicUrl } from "@/lib/shelby-public";

type UserMediaFields = {
  avatarUrl?: string | null;
  bannerUrl?: string | null;
  avatarCid?: string | null;
  avatarRef?: string | null;
  bannerCid?: string | null;
  bannerRef?: string | null;
};

/** Prefer Shelby blob ref as source of truth over cached URL. */
export function resolveAvatarUrl(user: UserMediaFields): string | null {
  const ref = user.avatarRef || user.avatarCid;
  if (ref) return getShelbyPublicUrl(ref);
  if (user.avatarUrl) {
    if (user.avatarUrl.startsWith("http") || user.avatarUrl.startsWith("/")) {
      return user.avatarUrl;
    }
    return getShelbyPublicUrl(user.avatarUrl);
  }
  return null;
}

export function resolveBannerUrl(user: UserMediaFields): string | null {
  const ref = user.bannerRef || user.bannerCid;
  if (ref) return getShelbyPublicUrl(ref);
  if (user.bannerUrl) {
    if (user.bannerUrl.startsWith("http") || user.bannerUrl.startsWith("/")) {
      return user.bannerUrl;
    }
    return getShelbyPublicUrl(user.bannerUrl);
  }
  return null;
}

/** DB fields to persist after a Shelby profile media upload. */
export function profileMediaDbFields(
  kind: "avatar" | "banner",
  blobRef: string
): Record<string, string> {
  const url = getShelbyPublicUrl(blobRef);
  if (kind === "avatar") {
    return { avatarRef: blobRef, avatarCid: blobRef, avatarUrl: url };
  }
  return { bannerRef: blobRef, bannerCid: blobRef, bannerUrl: url };
}