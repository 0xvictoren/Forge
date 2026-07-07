import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { completeMultipartUpload, abortMultipartUpload, type CompletedPart } from "@/lib/s3";

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { key, uploadId, parts, fileName, contentType, fileSize } = await request.json();
  if (!key || !uploadId || !Array.isArray(parts)) {
    return NextResponse.json({ error: "key, uploadId and parts[] required" }, { status: 400 });
  }

  try {
    const result = await completeMultipartUpload(key, uploadId, parts as CompletedPart[]);
    // Return the public URL that can be used as blobRef (http url works with getShelbyPublicUrl)
    return NextResponse.json({
      publicUrl: result.publicUrl,
      key,
      fileName,
      contentType,
      fileSize,
    });
  } catch (e: any) {
    console.error("Multipart complete error", e);
    try {
      await abortMultipartUpload(key, uploadId);
    } catch {}
    return NextResponse.json({ error: "Failed to complete multipart upload" }, { status: 500 });
  }
}
