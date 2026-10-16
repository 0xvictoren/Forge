import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { completeMultipartUpload, abortMultipartUpload, type CompletedPart } from "@/lib/s3";
import { z } from "zod";

const completeSchema = z.object({
  key: z.string().min(1).max(1_024),
  uploadId: z.string().min(1).max(1_024),
  parts: z.array(z.object({
    ETag: z.string().min(1).max(512),
    PartNumber: z.number().int().min(1).max(10_000),
  })).min(1).max(10_000),
  fileName: z.string().max(512).optional(),
  contentType: z.string().max(200).optional(),
  fileSize: z.number().int().positive().max(5 * 1024 * 1024 * 1024).optional(),
});

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = completeSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "key, uploadId and parts[] required" }, { status: 400 });
  }
  const { key, uploadId, parts, fileName, contentType, fileSize } = parsed.data;
  if (!key.startsWith(`streams/${user.id}/`)) {
    return NextResponse.json({ error: "Forbidden upload key" }, { status: 403 });
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
