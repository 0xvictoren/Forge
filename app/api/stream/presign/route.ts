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

  const { fileName, contentType, fileSize } = await request.json();

  if (!fileName || !contentType) {
    return NextResponse.json({ error: "fileName and contentType required" }, { status: 400 });
  }

  // Only videos for Stream (legacy S3 Gateway path — Stream uploads now prefer /api/upload/stream)
  if (!contentType.startsWith("video/")) {
    return NextResponse.json({ error: "Only video files allowed for Stream" }, { status: 400 });
  }

  const key = `streams/${user.id}/${Date.now()}-${fileName.replace(/[^a-zA-Z0-9.-]/g, "_")}`;

  const command = new PutObjectCommand({
    Bucket: S3_BUCKET,
    Key: key,
    ContentType: contentType,
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
