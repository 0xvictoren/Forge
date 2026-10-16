import type { BurnLink, AccessGrant } from "@prisma/client";
import { prisma } from "@/lib/db";
import { normalizeAptosAddress, isWalletAllowed, ACCESS_DENIED_MESSAGE } from "./wallet-access";
import { buildSignedMediaUrl, verifyMediaAccess } from "./media-access-token";

export type BurnLinkAccessContext = BurnLink & {
  owner?: { walletAddress?: string | null; address?: string | null };
};

export function ownerWalletOf(burnLink: BurnLinkAccessContext): string | null {
  return burnLink.owner?.walletAddress || burnLink.owner?.address || null;
}

export function assertWalletGate(
  burnLink: BurnLinkAccessContext,
  walletAddress: string
): { ok: true } | { ok: false; error: string; status: number } {
  const owner = ownerWalletOf(burnLink);
  const allowed = isWalletAllowed(walletAddress, burnLink.allowedWallets, {
    walletGated: burnLink.walletGated,
    ownerWallet: owner,
  });
  if (!allowed) {
    return { ok: false, error: ACCESS_DENIED_MESSAGE, status: 403 };
  }
  return { ok: true };
}

export function assertGrantWallet(
  grant: AccessGrant,
  walletAddress: string
): { ok: true } | { ok: false; error: string; status: number } {
  try {
    if (normalizeAptosAddress(grant.walletAddress) !== normalizeAptosAddress(walletAddress)) {
      return { ok: false, error: "Access denied, wallet mismatch", status: 403 };
    }
  } catch {
    return { ok: false, error: "Invalid wallet address", status: 400 };
  }
  return { ok: true };
}

export function assertViewLimits(
  burnLink: BurnLink,
  grant: AccessGrant
): { ok: true } | { ok: false; error: string; status: number } {
  if (burnLink.expiresAt && burnLink.expiresAt.getTime() < Date.now()) {
    return { ok: false, error: "This link has expired", status: 410 };
  }

  if (burnLink.maxViews != null && grant.viewsUsed >= burnLink.maxViews) {
    return { ok: false, error: "Max views exceeded", status: 403 };
  }

  if (burnLink.burnAfterRead && grant.viewsUsed > 0) {
    return { ok: false, error: "This file has been consumed", status: 403 };
  }

  if (burnLink.oneTime && grant.viewsUsed > 0) {
    return { ok: false, error: "One-time access already used", status: 403 };
  }

  return { ok: true };
}

/** Atomically consume one view so concurrent requests cannot exceed limits. */
export async function consumeGrantView(
  burnLink: BurnLink,
  grant: AccessGrant
): Promise<
  | { ok: true; grant: AccessGrant }
  | { ok: false; error: string; status: number }
> {
  const limits = assertViewLimits(burnLink, grant);
  if (!limits.ok) return limits;

  const singleUse = burnLink.burnAfterRead || burnLink.oneTime;
  const maximum = singleUse ? 1 : burnLink.maxViews;
  const updated = await prisma.accessGrant.updateMany({
    where: {
      id: grant.id,
      ...(maximum != null ? { viewsUsed: { lt: maximum } } : {}),
    },
    data: { viewsUsed: { increment: 1 } },
  });

  if (updated.count !== 1) {
    return {
      ok: false,
      error: singleUse ? "This file has been consumed" : "Max views exceeded",
      status: 403,
    };
  }

  const consumedGrant = await prisma.accessGrant.findUnique({
    where: { id: grant.id },
  });
  if (!consumedGrant) {
    return { ok: false, error: "Access denied", status: 403 };
  }
  return { ok: true, grant: consumedGrant };
}

/** Whether media for this BurnLink must use signed proxy URLs. */
export function requiresSignedMedia(burnLink: BurnLink): boolean {
  return burnLink.priceApt > 0 || burnLink.walletGated;
}

export function buildGrantStreamUrl(opts: {
  burnLink: BurnLink;
  grant: AccessGrant;
  blobId: string;
  fileName: string;
  download?: boolean;
}): string {
  if (requiresSignedMedia(opts.burnLink)) {
    return buildSignedMediaUrl({
      ref: opts.blobId,
      grantId: opts.grant.id,
      wallet: opts.grant.walletAddress,
      fileName: opts.fileName,
      download: opts.download,
    });
  }
  const base = `/api/media/shelby?ref=${encodeURIComponent(opts.blobId)}`;
  let url = `${base}&filename=${encodeURIComponent(opts.fileName)}`;
  if (opts.download) url += "&download=1";
  return url;
}

/** Validate signed media query params against DB grant. */
export async function validateSignedMediaRequest(params: {
  ref: string;
  grantId: string;
  wallet: string;
  exp: number;
  sig: string;
}): Promise<
  | { ok: true; grant: AccessGrant; burnLink: BurnLink }
  | { ok: false; error: string; status: number }
> {
  if (
    !verifyMediaAccess({
      grantId: params.grantId,
      wallet: params.wallet,
      ref: params.ref,
      exp: params.exp,
      sig: params.sig,
    })
  ) {
    return { ok: false, error: "Invalid or expired media signature", status: 403 };
  }

  const grant = await prisma.accessGrant.findUnique({
    where: { id: params.grantId },
    include: { burnLink: { include: { file: true } } },
  });

  if (!grant || !grant.burnLink) {
    return { ok: false, error: "Access denied", status: 403 };
  }

  if (grant.burnLink.file.blobId !== params.ref) {
    return { ok: false, error: "Access denied", status: 403 };
  }

  const walletCheck = assertGrantWallet(grant, params.wallet);
  if (!walletCheck.ok) return walletCheck;

  const gateCheck = assertWalletGate(grant.burnLink, params.wallet);
  if (!gateCheck.ok) return gateCheck;

  if (grant.burnLink.expiresAt && grant.burnLink.expiresAt.getTime() < Date.now()) {
    return { ok: false, error: "This link has expired", status: 410 };
  }

  return { ok: true, grant, burnLink: grant.burnLink };
}

/** Block bare ref access when blob belongs to a protected BurnLink. */
export async function isProtectedBlob(ref: string): Promise<boolean> {
  const file = await prisma.file.findFirst({
    where: { blobId: ref },
    include: { burnLink: true },
  });
  if (!file?.burnLink) return false;
  return requiresSignedMedia(file.burnLink);
}
