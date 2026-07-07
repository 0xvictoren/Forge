import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

export type AssetWithOwner = {
  id: string;
  userId: string;
  priceApt: number;
  visibility: string;
  blobRef: string;
  vaultAssets?: { vaultId: string }[];
};

export async function getCurrentUserId(): Promise<string | null> {
  const u = await getSessionUser();
  return u?.id ?? null;
}

/**
 * Check if user has an active subscription that covers this creator (for vault or asset access).
 */
async function hasActiveSubscriptionForCreator(userId: string, creatorUserId: string): Promise<boolean> {
  const grants = await prisma.subscriberGrant.findMany({
    where: { subscriberId: userId, status: "active", renewsAt: { gte: new Date() } },
    include: { tier: { include: { creator: true } } },
  });
  return grants.some((g) => g.tier?.creator?.userId === creatorUserId);
}

/**
 * Core access check for an Asset.
 * Rules (per Forge flows):
 * - Owner always has access (free).
 * - Free / priceApt=0 or visibility public free: allow.
 * - Has direct Purchase record as buyer: allow.
 * - Has Purchase of a *Bundle/Product* that contains this asset: allow.
 * - If asset is in a published vault the user is member/owner/sub of: allow.
 * - Has active Subscription from the asset's creator: allow (for membership gated content).
 * - Else: no access (must buy).
 */
export async function canUserAccessAsset(
  userId: string | null,
  asset: AssetWithOwner | null | undefined
): Promise<{ canAccess: boolean; reason?: string; isOwner: boolean; hasPurchased: boolean }> {
  if (!asset) return { canAccess: false, reason: "Asset not found", isOwner: false, hasPurchased: false };

  const isOwner = !!userId && userId === asset.userId;
  if (isOwner) return { canAccess: true, isOwner: true, hasPurchased: false };

  // Free assets only — visibility "public" means discoverable, not free download
  if (asset.priceApt <= 0) {
    return { canAccess: true, isOwner: false, hasPurchased: false };
  }

  if (!userId) {
    return { canAccess: false, reason: "Sign in to access", isOwner: false, hasPurchased: false };
  }

  // 1. Direct asset purchase
  const directPurchase = await prisma.purchase.findFirst({
    where: { buyerId: userId, assetId: asset.id },
  });
  if (directPurchase) {
    return { canAccess: true, isOwner: false, hasPurchased: true };
  }

  // 2. Bundle / Product purchase that contains this asset
  const bundlePurchases = await prisma.purchase.findMany({
    where: { buyerId: userId, productId: { not: null } },
    include: { product: { include: { items: true } } },
  });
  const ownsViaBundle = bundlePurchases.some((p) =>
    p.product?.items?.some((item) => item.assetId === asset.id)
  );
  if (ownsViaBundle) {
    return { canAccess: true, isOwner: false, hasPurchased: true };
  }

  // 3. Vault membership / published
  const va = await prisma.vaultAsset.findFirst({
    where: { assetId: asset.id },
    include: {
      vault: {
        include: {
          members: { where: { userId } },
        },
      },
    },
  });

  if (va) {
    const v = va.vault;
    const isVaultMemberOrOwner = v.userId === userId || v.members.length > 0;
    if (isVaultMemberOrOwner || v.isPublished) {
      if (v.priceApt == null || v.priceApt <= 0 || isVaultMemberOrOwner) {
        return { canAccess: true, isOwner: false, hasPurchased: false };
      }
    }
  }

  // 4. Active subscription from the asset creator
  const hasSub = await hasActiveSubscriptionForCreator(userId, asset.userId);
  if (hasSub) {
    return { canAccess: true, isOwner: false, hasPurchased: false };
  }

  return { canAccess: false, reason: "Purchase or active subscription required", isOwner: false, hasPurchased: false };
}

/**
 * For server routes: given blobRef, resolve if it's an asset blob and check access for current session.
 */
export async function checkAssetBlobAccess(ref: string): Promise<
  | { ok: true; asset: any; isOwner: boolean; hasPurchased: boolean }
  | { ok: false; status: number; error: string }
> {
  const asset = await prisma.asset.findFirst({ where: { blobRef: ref } });
  if (!asset) {
    return { ok: false, status: 404, error: "Not an asset blob" };
  }

  const user = await getSessionUser();
  const userId = user?.id ?? null;

  const { canAccess, reason, isOwner, hasPurchased } = await canUserAccessAsset(userId, asset);
  if (!canAccess) {
    return { ok: false, status: 403, error: reason || "Access denied" };
  }
  return { ok: true, asset, isOwner, hasPurchased };
}
