import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

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

  if (!token) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
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
    },
  });

  if (!burnlink) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const grant = await prisma.accessGrant.findFirst({
    where: { burnLinkId: burnlink.id, viewToken: token },
  });

  if (!grant) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  if (burnlink.maxViews != null && grant.viewsUsed >= burnlink.maxViews) {
    return NextResponse.json({ error: "Max views exceeded" }, { status: 403 });
  }

  const remainingViews =
    burnlink.maxViews != null ? Math.max(0, burnlink.maxViews - grant.viewsUsed) : null;

  return NextResponse.json({
    id: burnlink.id,
    title: burnlink.title || burnlink.file.fileName || "Untitled BurnLink",
    description: "",
    blobRefs: [burnlink.file.blobId],
    mimeType: burnlink.file.mimeType || "application/octet-stream",
    streamUrl: `/api/media/shelby?ref=${encodeURIComponent(burnlink.file.blobId)}`,
    remainingViews,
    expiresAt: burnlink.expiresAt,
    expiresIn: formatExpiresIn(burnlink.expiresAt),
  });
}
