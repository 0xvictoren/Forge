import {
  S3Client,
  DeleteObjectCommand,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand,
  PutObjectCommand,
  type CompletedPart as AwsCompletedPart,
} from "@aws-sdk/client-s3";

export type CompletedPart = AwsCompletedPart;
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import {
  S3_ENDPOINT,
  S3_REGION,
  S3_ACCESS_KEY_ID,
  S3_SECRET_ACCESS_KEY,
  S3_BUCKET,
} from "@/lib/constants-shelby";

export const s3Client = new S3Client({
  endpoint: S3_ENDPOINT,
  region: S3_REGION,
  credentials: {
    accessKeyId: S3_ACCESS_KEY_ID,
    secretAccessKey: S3_SECRET_ACCESS_KEY,
  },
  forcePathStyle: true,
});

/** Delete an object from S3 (used for Stream video cleanup on user delete). */
export async function deleteFromS3(keyOrUrl: string): Promise<boolean> {
  try {
    let key = keyOrUrl;
    // If full URL, extract key after bucket
    if (keyOrUrl.startsWith("http")) {
      const url = new URL(keyOrUrl);
      // path like /bucket/key or /key depending on gateway
      const parts = url.pathname.split("/").filter(Boolean);
      // Assume first segment after host is bucket or the key starts after
      if (parts[0] === S3_BUCKET) {
        key = parts.slice(1).join("/");
      } else {
        key = parts.join("/");
      }
    }
    if (!key) return false;

    await s3Client.send(
      new DeleteObjectCommand({
        Bucket: S3_BUCKET,
        Key: key,
      })
    );
    return true;
  } catch (e) {
    console.error("S3 delete failed for", keyOrUrl, e);
    return false;
  }
}

/** Presign a single PUT (used for small/medium videos). */
export async function getPresignedPutUrl(key: string, contentType: string, expiresIn = 3600) {
  const command = new PutObjectCommand({
    Bucket: S3_BUCKET,
    Key: key,
    ContentType: contentType,
  });
  const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn });
  const publicUrl = `${S3_ENDPOINT.replace(/\/$/, "")}/${S3_BUCKET}/${key}`;
  return { uploadUrl, publicUrl, key };
}



/** Multipart: initiate */
export async function initiateMultipartUpload(key: string, contentType: string) {
  const res = await s3Client.send(
    new CreateMultipartUploadCommand({
      Bucket: S3_BUCKET,
      Key: key,
      ContentType: contentType,
    })
  );
  return { uploadId: res.UploadId!, key };
}

/** Multipart: presign one part upload URL */
export async function getPresignedPartUrl(key: string, uploadId: string, partNumber: number, expiresIn = 3600) {
  const command = new UploadPartCommand({
    Bucket: S3_BUCKET,
    Key: key,
    UploadId: uploadId,
    PartNumber: partNumber,
  });
  const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn });
  return uploadUrl;
}

/** Multipart: complete */
export async function completeMultipartUpload(key: string, uploadId: string, parts: CompletedPart[]) {
  const res = await s3Client.send(
    new CompleteMultipartUploadCommand({
      Bucket: S3_BUCKET,
      Key: key,
      UploadId: uploadId,
      MultipartUpload: { Parts: parts },
    })
  );
  const publicUrl = `${S3_ENDPOINT.replace(/\/$/, "")}/${S3_BUCKET}/${key}`;
  return { publicUrl, location: res.Location };
}

/** Abort multipart (cleanup on failure) */
export async function abortMultipartUpload(key: string, uploadId: string) {
  try {
    await s3Client.send(
      new AbortMultipartUploadCommand({ Bucket: S3_BUCKET, Key: key, UploadId: uploadId })
    );
  } catch {}
}
