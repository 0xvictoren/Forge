import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { recordAnalyticsEvent } from "@/lib/analytics";
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

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  const user = await getSessionUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!token) {
    return NextResponse.json({ error: "Access token required" }, { status: 401 });
  }

  let walletAddress: string;
  try {
    walletAddress = normalizeAptosAddress(user.walletAddress || user.address || "");
  } catch {
    return NextResponse.json({ error: "Authenticated wallet required" }, { status: 401 });
  }

  const burnLink = await prisma.burnLink.findUnique({
    where: { slug },
    include: { file: true, owner: true },
  });

  if (!burnLink) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const gate = assertWalletGate(burnLink, walletAddress);
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }

  const grant = await prisma.accessGrant.findFirst({
    where: { burnLinkId: burnLink.id, viewToken: token, userId: user.id },
  });

  if (!grant) {
    return NextResponse.json({ error: "Invalid token" }, { status: 403 });
  }

  const walletMatch = assertGrantWallet(grant, walletAddress);
  if (!walletMatch.ok) {
    return NextResponse.json({ error: walletMatch.error }, { status: walletMatch.status });
  }

  const consumed = await consumeGrantView(burnLink, grant);
  if (!consumed.ok) {
    return NextResponse.json({ error: consumed.error }, { status: consumed.status });
  }

  await recordAnalyticsEvent({
    creatorId: burnLink.userId,
    burnLinkId: burnLink.id,
    eventType: "DOWNLOAD",
    walletAddr: grant.walletAddress,
  });

  const fileName = burnLink.file.fileName || "download";
  const streamUrl = buildGrantStreamUrl({
    burnLink,
    grant: consumed.grant,
    blobId: burnLink.file.blobId,
    fileName,
  });

  const ownerWallet = ownerWalletOf(burnLink);
  let isOwner = false;
  try {
    isOwner =
      burnLink.userId === user.id &&
      !!ownerWallet &&
      normalizeAptosAddress(ownerWallet) === normalizeAptosAddress(walletAddress);
  } catch {
    isOwner = false;
  }

  const encryption = toAuthorizedKeyPackage(
    {
      isEncrypted: burnLink.file.isEncrypted,
      encryptionVersion: burnLink.file.encryptionVersion,
      wrappedKeyOwner: burnLink.file.wrappedKeyOwner,
      wrappedKeyShare: burnLink.file.wrappedKeyShare,
      encryptionShareKey: burnLink.file.encryptionShareKey,
      mimeType: burnLink.file.mimeType,
      fileName,
    },
    { includeOwnerWrap: isOwner }
  );

  return NextResponse.json({
    streamUrl,
    fileName,
    mimeType: burnLink.file.mimeType,
    screenshotProtected: burnLink.screenshotProtected,
    disableDownload: burnLink.disableDownload,
    isEncrypted: !!burnLink.file.isEncrypted,
    encryption,
    asOwner: isOwner,
  });
}
