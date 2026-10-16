import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { normalizeAptosAddress } from "@/lib/wallet-access";
import {
  assertGrantWallet,
  consumeGrantView,
  assertWalletGate,
  buildGrantStreamUrl,
  ownerWalletOf,
} from "@/lib/burnlink-access";
import { toAuthorizedKeyPackage } from "@/lib/encryption";
import { getSessionUser } from "@/lib/auth";

function formatExpiresIn(expiresAt: Date | null): string | null {
  if (!expiresAt) return null;
  const diff = expiresAt.getTime() - Date.now();
  if (diff <= 0) return "expired";
  const totalMinutes = Math.floor(diff / (1000 * 60));
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;
  return `${days}d ${hours}h ${minutes}m`;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const token = req.nextUrl.searchParams.get("token");
  const { slug } = await params;
  const user = await getSessionUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!token) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  let walletAddress: string;
  try {
    walletAddress = normalizeAptosAddress(user.walletAddress || user.address || "");
  } catch {
    return NextResponse.json({ error: "Authenticated wallet required" }, { status: 401 });
  }

  const burnlink = await prisma.burnLink.findUnique({
    where: { slug },
    include: {
      file: {
        select: {
          blobId: true,
          mimeType: true,
          fileName: true,
          isEncrypted: true,
          encryptionVersion: true,
          wrappedKeyOwner: true,
          wrappedKeyShare: true,
          encryptionShareKey: true,
        },
      },
      owner: {
        select: { walletAddress: true, address: true },
      },
    },
  });

  if (!burnlink) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const gate = assertWalletGate(burnlink, walletAddress);
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }

  const grant = await prisma.accessGrant.findFirst({
    where: { burnLinkId: burnlink.id, viewToken: token, userId: user.id },
  });

  if (!grant) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  const walletMatch = assertGrantWallet(grant, walletAddress);
  if (!walletMatch.ok) {
    return NextResponse.json({ error: walletMatch.error }, { status: walletMatch.status });
  }

  const consumed = await consumeGrantView(burnlink, grant);
  if (!consumed.ok) {
    return NextResponse.json({ error: consumed.error }, { status: consumed.status });
  }

  const fileName = burnlink.file.fileName || "download";
  const streamUrl = buildGrantStreamUrl({
    burnLink: burnlink,
    grant: consumed.grant,
    blobId: burnlink.file.blobId,
    fileName,
  });

  const viewsAfter = consumed.grant.viewsUsed;
  const remainingViews =
    burnlink.maxViews != null
      ? Math.max(0, burnlink.maxViews - viewsAfter)
      : null;

  const ownerWallet = ownerWalletOf(burnlink);
  let isOwner = false;
  try {
    isOwner =
      burnlink.userId === user.id &&
      !!ownerWallet &&
      normalizeAptosAddress(ownerWallet) === normalizeAptosAddress(walletAddress);
  } catch {
    isOwner = false;
  }

  const encryption = toAuthorizedKeyPackage(
    {
      isEncrypted: burnlink.file.isEncrypted,
      encryptionVersion: burnlink.file.encryptionVersion,
      wrappedKeyOwner: burnlink.file.wrappedKeyOwner,
      wrappedKeyShare: burnlink.file.wrappedKeyShare,
      encryptionShareKey: burnlink.file.encryptionShareKey,
      mimeType: burnlink.file.mimeType,
      fileName,
    },
    { includeOwnerWrap: isOwner }
  );

  return NextResponse.json({
    id: burnlink.id,
    title: burnlink.title || fileName || "Untitled BurnLink",
    description: "",
    blobRefs: [burnlink.file.blobId],
    mimeType: burnlink.file.mimeType || "application/octet-stream",
    streamUrl,
    fileName,
    remainingViews,
    expiresAt: burnlink.expiresAt,
    expiresIn: formatExpiresIn(burnlink.expiresAt),
    screenshotProtected: burnlink.screenshotProtected,
    disableDownload: burnlink.disableDownload,
    slug,
    isEncrypted: !!burnlink.file.isEncrypted,
    encryption,
    asOwner: isOwner,
  });
}
