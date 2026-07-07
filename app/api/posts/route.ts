import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getShelbyPublicUrl } from "@/lib/shelby";
import { createNotification } from "@/lib/notifications";

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const contentType = request.headers.get("content-type") || "";
  let text = "";
  let category: string | undefined;
  let mediaCid: string | undefined;
  let mediaType: string | undefined;
  let thumbnailCid: string | undefined;

  if (!contentType.includes("application/json")) {
    return NextResponse.json(
      {
        error:
          "Upload media with your connected wallet first, then POST JSON with blobRef.",
      },
      { status: 400 }
    );
  }

  const body = await request.json();
  text = body.text || "";
  category = body.category;
  mediaCid = body.blobRef || body.mediaCid;
  if (mediaCid) {
    const mime = (body.mimeType as string) || "";
    mediaType = body.mediaType
      ? String(body.mediaType).toUpperCase()
      : mime.startsWith("video/")
        ? "VIDEO"
        : mime.startsWith("audio/")
          ? "AUDIO"
          : "IMAGE";
    thumbnailCid = body.thumbnailCid || (mime.startsWith("image/") ? mediaCid : undefined);
  }

  if (!text.trim() && !mediaCid) {
    return NextResponse.json({ error: "Add text or media" }, { status: 400 });
  }

  const post = await prisma.post.create({
    data: {
      userId: user.id,
      text: text.trim() || null,
      mediaCid,
      mediaType,
      thumbnailCid,
      category,
      isPublic: true,
    },
  });

  await createNotification({
    userId: user.id,
    type: "UPLOAD_COMPLETE",
    title: "Post published",
    body: "Your post is now live on the feed.",
    href: user.username ? `/${user.username}` : "/home",
  });

  return NextResponse.json({
    post: {
      ...post,
      mediaUrl: mediaCid ? getShelbyPublicUrl(mediaCid) : null,
    },
  });
}
