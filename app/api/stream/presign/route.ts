import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import {
  S3_ENDPOINT,
  S3_REGION,
  S3_ACCESS_KEY_ID,
  S3_SECRET_ACCESS_KEY,
  S3_BUCKET,
} from "@/lib/constants-shelby";
import { z } from "zod";
import { checkRateLimit } from "@/lib/rate-limit";

const presignSchema = z.object({
  fileName: z.string().trim().min(1).max(255),
  contentType: z.string().regex(/^video\/[a-z0-9.+-]+$/i).max(200),
  fileSize: z.number().int().positive().max(500 * 1024 * 1024),
});

const s3Client = new S3Client({
  endpoint: S3_ENDPOINT,
  region: S3_REGION,
  credentials: {
    accessKeyId: S3_ACCESS_KEY_ID,
    secretAccessKey: S3_SECRET_ACCESS_KEY,
  },
  forcePathStyle: true, // for custom S3 gateways
});

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rate = checkRateLimit(`stream-presign:${user.id}`, {
    limit: 20,
    windowMs: 60 * 60 * 1_000,
  });
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Upload limit reached" },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } }
    );
  }

  const parsed = presignSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Valid video metadata required" }, { status: 400 });
  }
  const { fileName, contentType, fileSize } = parsed.data;

  const key = `streams/${user.id}/${Date.now()}-${fileName.replace(/[^a-zA-Z0-9.-]/g, "_")}`;

  const command = new PutObjectCommand({
    Bucket: S3_BUCKET,
    Key: key,
    ContentType: contentType,
    ContentLength: fileSize,
    // ACL: "public-read", // if needed, depending on gateway
  });

  try {
    const uploadUrl = await getSignedUrl(s3Client, command, {
      expiresIn: 3600, // 1 hour
    });

    const publicUrl = `${S3_ENDPOINT.replace(/\/$/, "")}/${S3_BUCKET}/${key}`;

    return NextResponse.json({
      uploadUrl,
      key,
      publicUrl,
      // For client to use as the ref or store
    });
  } catch (error) {
    console.error("S3 presign error:", error);
    return NextResponse.json({ error: "Failed to generate upload URL" }, { status: 500 });
  }
}
