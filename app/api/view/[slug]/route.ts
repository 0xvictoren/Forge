import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { recordAnalyticsEvent } from "@/lib/analytics";
import { normalizeAptosAddress } from "@/lib/wallet-access";
import {
  assertGrantWallet,
  assertViewLimits,
  assertWalletGate,
  buildGrantStreamUrl,
} from "@/lib/burnlink-access";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  const rawWallet = url.searchParams.get("walletAddress") || "";

  if (!token) {
    return NextResponse.json({ error: "Access token required" }, { status: 401 });
  }

  if (!rawWallet) {
    return NextResponse.json({ error: "Wallet address required" }, { status: 401 });
  }

  let walletAddress: string;
  try {
    walletAddress = normalizeAptosAddress(rawWallet);
  } catch {
    return NextResponse.json({ error: "Invalid wallet address" }, { status: 400 });
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
    where: { burnLinkId: burnLink.id, viewToken: token },
  });

  if (!grant) {
    return NextResponse.json({ error: "Invalid token" }, { status: 403 });
  }

  const walletMatch = assertGrantWallet(grant, walletAddress);
  if (!walletMatch.ok) {
    return NextResponse.json({ error: walletMatch.error }, { status: walletMatch.status });
  }

  const limits = assertViewLimits(burnLink, grant);
  if (!limits.ok) {
    return NextResponse.json({ error: limits.error }, { status: limits.status });
  }

  await prisma.accessGrant.update({
    where: { id: grant.id },
    data: { viewsUsed: { increment: 1 } },
  });

  await recordAnalyticsEvent({
    creatorId: burnLink.userId,
    burnLinkId: burnLink.id,
    eventType: "DOWNLOAD",
    walletAddr: grant.walletAddress,
  });

  const fileName = burnLink.file.fileName || "download";
  const streamUrl = buildGrantStreamUrl({
    burnLink,
    grant,
    blobId: burnLink.file.blobId,
    fileName,
  });

  return NextResponse.json({
    streamUrl,
    fileName,
    mimeType: burnLink.file.mimeType,
    screenshotProtected: burnLink.screenshotProtected,
    disableDownload: burnLink.disableDownload,
  });
}
