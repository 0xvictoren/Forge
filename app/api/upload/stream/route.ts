import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { uploadVideoToStream } from "@/lib/shelby-media-upload";

/**
 * POST /api/upload/stream
 *
 * Secure server-side video upload for the "Stream" feature using the Shelby Media Kit.
 * Uses the dedicated helper for uploading videos as durable blobs on ShelbyNet.
 *
 * Accepts multipart/form-data:
 *   - file (required): Video file
 *   - title (optional): Used for better blob naming
 *   - durationSeconds (optional): Captured client-side for accurate metadata
 *
 * The route is hardened to ALWAYS return a valid JSON response:
 * - Early Content-Length check before body parsing (prevents framework "body too large" errors that return HTML).
 * - Nested try/catch around FormData parsing.
 * - Top-level catch that turns any unexpected error into { error, details } JSON.
 *
 * This eliminates "Failed to execute 'json' on 'Response': Unexpected end of JSON input" on the client.
 */
export async function POST(req: NextRequest) {
  try {
    // 1. Early size check using Content-Length header (before consuming body)
    // This prevents large video uploads from triggering framework-level body size errors
    // that return non-JSON responses (which cause "Unexpected end of JSON input" on client .json()).
    const MAX_SIZE = 500 * 1024 * 1024;
    const contentLength = Number(req.headers.get("content-length") || 0);
    if (contentLength > MAX_SIZE) {
      return NextResponse.json(
        {
          error: "Video too large",
          details: `Maximum allowed size is 500MB. Received ${(contentLength / 1024 / 1024).toFixed(1)}MB`,
        },
        { status: 413 }
      );
    }

    // 2. Auth first
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized", details: "You must be logged in to upload streams." },
        { status: 401 }
      );
    }

    // 3. Parse form data safely (with improved error handling)
    let form: FormData;
    try {
      form = await req.formData();
    } catch (formErr: any) {
      console.error("Stream Upload - FormData parse error:", formErr);
      const msg = String(formErr?.message || formErr);
      const isSizeError = msg.includes("size") || msg.includes("limit") || msg.includes("413") || msg.includes("too large");
      return NextResponse.json(
        {
          error: isSizeError ? "Video too large" : "Invalid upload request",
          details: isSizeError
            ? "The video exceeds the maximum allowed size or could not be processed."
            : "Could not parse form data. The file may be corrupted or too large for direct upload.",
        },
        { status: isSizeError ? 413 : 400 }
      );
    }

    const file = form.get("file") as File | null;
    const title = (form.get("title") as string) || undefined;
    const clientDuration = form.get("durationSeconds")
      ? Number(form.get("durationSeconds"))
      : null;

    // 4. Validation (header size already checked; this is a defense-in-depth check on the parsed file)
    if (!file) {
      return NextResponse.json(
        { error: "Video file is required", details: "No file was attached to the request." },
        { status: 400 }
      );
    }

    if (!file.type?.startsWith("video/")) {
      return NextResponse.json(
        { error: "Only video files are allowed for Stream uploads", details: `Received type: ${file.type}` },
        { status: 400 }
      );
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        {
          error: "Video too large",
          details: `Maximum allowed size is 500MB. Received ${(file.size / 1024 / 1024).toFixed(1)}MB`,
        },
        { status: 413 }
      );
    }

    // 5. Perform the actual Shelby Media Kit upload
    const result = await uploadVideoToStream(file, title);

    // Enrich with client-provided duration (most accurate source)
    const duration = clientDuration ?? result.duration ?? null;

    const video = {
      blobRef: result.blobRef,
      url: result.url,
      duration,
      size: result.size,
      fileName: result.fileName,
      mimeType: result.mimeType,
      shelbyTxHash: result.shelbyTxHash || null,
    };

    const streamUrl = result.url;

    // 6. Success response
    // We return BOTH:
    // - The nested shape (video + streamUrl) as per the requested spec
    // - Top-level fields (blobRef, url, etc.) for compatibility with the existing
    //   Stream upload UI code in /upload page which does `if (data.blobRef)`
    return NextResponse.json({
      success: true,
      video,
      streamUrl,
      message: "Video uploaded to Shelby successfully",

      // Legacy top-level fields (prevents "Upload response missing blobRef")
      blobRef: result.blobRef,
      url: result.url,
      durationSeconds: duration,
      fileName: result.fileName,
      mimeType: result.mimeType,
      size: result.size,
      shelbyTxHash: result.shelbyTxHash || null,
    });
  } catch (error: any) {
    console.error("Stream Upload Error:", error);

    // Always return JSON, even on unexpected failures.
    // This prevents "Unexpected end of JSON input" on the client.
    return NextResponse.json(
      {
        error: "Failed to upload video to Shelby",
        details: error?.message || "An unexpected error occurred during the Shelby upload.",
      },
      { status: 500 }
    );
  }
}
