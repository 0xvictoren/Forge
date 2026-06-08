import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { uploadToShelby } from "@/lib/shelby-server";
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

  if (contentType.includes("application/json")) {
    const body = await request.json();
    text = body.text || "";
    category = body.category;
    mediaCid = body.blobRef || body.mediaCid;
    if (mediaCid) mediaType = "IMAGE";
  } else {
    const form = await request.formData();
    text = (form.get("text") as string) || "";
    category = (form.get("category") as string) || undefined;
    const file = form.get("media") as File | null;

    if (file && file.size > 0) {
      const upload = await uploadToShelby(file, file.name, { type: "post" });
      mediaCid = upload.cid;
      mediaType = file.type.startsWith("video/")
        ? "VIDEO"
        : file.type.startsWith("audio/")
          ? "AUDIO"
          : "IMAGE";
      thumbnailCid = file.type.startsWith("image/") ? upload.cid : undefined;
    }
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
