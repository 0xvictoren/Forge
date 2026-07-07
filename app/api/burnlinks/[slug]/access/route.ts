import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { normalizeAptosAddress } from "@/lib/wallet-access";
import {
  assertGrantWallet,
  assertViewLimits,
  assertWalletGate,
  buildGrantStreamUrl,
} from "@/lib/burnlink-access";

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
  const rawWallet = req.nextUrl.searchParams.get("walletAddress") || "";
  const { slug } = await params;

  if (!token) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
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

  const burnlink = await prisma.burnLink.findUnique({
    where: { slug },
    include: {
      file: {
        select: {
          blobId: true,
          mimeType: true,
          fileName: true,
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
    where: { burnLinkId: burnlink.id, viewToken: token },
  });

  if (!grant) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  const walletMatch = assertGrantWallet(grant, walletAddress);
  if (!walletMatch.ok) {
    return NextResponse.json({ error: walletMatch.error }, { status: walletMatch.status });
  }

  const limits = assertViewLimits(burnlink, grant);
  if (!limits.ok) {
    return NextResponse.json({ error: limits.error }, { status: limits.status });
  }

  await prisma.accessGrant.update({
    where: { id: grant.id },
    data: { viewsUsed: { increment: 1 } },
  });

  const fileName = burnlink.file.fileName || "download";
  const streamUrl = buildGrantStreamUrl({
    burnLink: burnlink,
    grant,
    blobId: burnlink.file.blobId,
    fileName,
  });

  const viewsAfter = grant.viewsUsed + 1;
  const remainingViews =
    burnlink.maxViews != null
      ? Math.max(0, burnlink.maxViews - viewsAfter)
      : null;

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
  });
}
