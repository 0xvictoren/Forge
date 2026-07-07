import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { initiateMultipartUpload } from "@/lib/s3";

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { fileName, contentType } = await request.json();
  if (!fileName || !contentType?.startsWith("video/")) {
    return NextResponse.json({ error: "Valid video fileName and contentType required" }, { status: 400 });
  }

  const safeName = fileName.replace(/[^a-zA-Z0-9.-]/g, "_");
  const key = `streams/${user.id}/${Date.now()}-${safeName}`;

  try {
    const { uploadId, key: finalKey } = await initiateMultipartUpload(key, contentType);
    return NextResponse.json({ uploadId, key: finalKey });
  } catch (e: any) {
    console.error("Multipart init error", e);
    return NextResponse.json({ error: "Failed to initiate multipart upload" }, { status: 500 });
  }
}
