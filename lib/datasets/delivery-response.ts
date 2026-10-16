import "server-only";
import type { DatasetFile, DatasetLicense } from "@prisma/client";
import { jsonError } from "./api";
import {
  contentDisposition,
  countRecentDeliveries,
  deliverFile,
  logDatasetAccess,
  MAX_DELIVERIES_PER_FILE_PER_DAY,
} from "./server";

/** Shared by the browser download route and the pipeline route. */
export async function buildDeliveryResponse(input: {
  request: Request;
  file: DatasetFile;
  datasetId: string;
  userId: string;
  license: DatasetLicense | null;
  action: "DOWNLOAD" | "PIPELINE";
}) {
  const { request, file, license } = input;
  if (license) {
    const recent = await countRecentDeliveries(license.id, file.id);
    if (recent >= MAX_DELIVERIES_PER_FILE_PER_DAY) {
      return jsonError(
        `Daily limit reached for this file (${MAX_DELIVERIES_PER_FILE_PER_DAY} per 24h). It resets automatically.`,
        429,
        { "Retry-After": "3600" }
      );
    }
  }

  let delivery;
  try {
    delivery = await deliverFile(file, license);
  } catch (e) {
    console.error("[datasets] delivery failed", e);
    return jsonError("This file could not be retrieved from storage right now. Try again shortly.", 502);
  }

  await logDatasetAccess({
    request,
    datasetId: input.datasetId,
    licenseId: license?.id,
    userId: input.userId,
    fileId: file.id,
    action: input.action,
    deliveredSha256: delivery.kind === "buffer" ? delivery.sha256 : null,
  });

  const headers: Record<string, string> = {
    "Content-Type": file.mimeType || "application/octet-stream",
    "Content-Disposition": contentDisposition(file.path),
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
    "X-Forge-Fingerprinted": delivery.fingerprinted ? "1" : "0",
  };
  if (delivery.kind === "buffer") {
    headers["Content-Length"] = String(delivery.body.byteLength);
    headers["X-Forge-Delivered-Sha256"] = delivery.sha256;
    return new Response(delivery.body as BodyInit, { headers });
  }
  return new Response(delivery.body, { headers });
}
