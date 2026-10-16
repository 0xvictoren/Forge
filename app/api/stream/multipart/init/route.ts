import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { initiateMultipartUpload } from "@/lib/s3";
import { z } from "zod";
import { checkRateLimit } from "@/lib/rate-limit";

const initSchema = z.object({
  fileName: z.string().trim().min(1).max(255),
  contentType: z.string().regex(/^video\/[a-z0-9.+-]+$/i).max(200),
  fileSize: z.number().int().positive().max(5 * 1024 * 1024 * 1024).optional(),
});

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rate = checkRateLimit(`multipart-init:${user.id}`, {
    limit: 20,
    windowMs: 60 * 60 * 1_000,
  });
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Upload limit reached" },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } }
    );
  }

  const parsed = initSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Valid video fileName and contentType required" }, { status: 400 });
  }
  const { fileName, contentType } = parsed.data;

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
