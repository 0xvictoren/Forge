import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getShelbyPublicUrl, getShelbyGatedUrl } from "@/lib/shelby";
import { recordAnalyticsEvent } from "@/lib/analytics";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const token = new URL(request.url).searchParams.get("token");

  if (!token) {
    return NextResponse.json({ error: "Access token required" }, { status: 401 });
  }

  const burnLink = await prisma.burnLink.findUnique({
    where: { slug },
    include: { file: true, owner: true },
  });

  if (!burnLink) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const grant = await prisma.accessGrant.findFirst({
    where: { burnLinkId: burnLink.id, viewToken: token },
  });

  if (!grant) {
    return NextResponse.json({ error: "Invalid token" }, { status: 403 });
  }

  if (burnLink.maxViews && grant.viewsUsed >= burnLink.maxViews) {
    return NextResponse.json({ error: "Max views exceeded" }, { status: 403 });
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
  let streamUrl = getShelbyPublicUrl(burnLink.file.blobId);
  if (burnLink.priceApt > 0 && grant.walletAddress) {
    streamUrl = await getShelbyGatedUrl(
      burnLink.file.blobId,
      grant.walletAddress,
      token
    );
  }
  const sep = streamUrl.includes("?") ? "&" : "?";
  streamUrl = `${streamUrl}${sep}filename=${encodeURIComponent(fileName)}`;

  return NextResponse.json({
    streamUrl,
    fileName,
    mimeType: burnLink.file.mimeType,
    screenshotProtected: burnLink.screenshotProtected,
  });
}
