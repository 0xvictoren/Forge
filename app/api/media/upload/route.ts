import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { uploadToShelby } from "@/lib/shelby-server";
import { getShelbyPublicUrl } from "@/lib/shelby";

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const form = await request.formData();
  const file = form.get("file") as File | null;
  const type = (form.get("type") as string) || "upload";
  const expirationHours = Number(form.get("expirationHours") || 168);
  const aptosTxHash = (form.get("aptosTxHash") as string) || null;

  if (!file) {
    return NextResponse.json({ error: "File required" }, { status: 400 });
  }

  try {
    const expirationMicros = Date.now() * 1000 + expirationHours * 3600 * 1_000_000;
    const upload = await uploadToShelby(file, file.name, {
      type,
      expirationMicros,
    });

    return NextResponse.json({
      success: true,
      blobRef: upload.cid,
      shelbyTxHash: upload.shelbyTxHash,
      aptosTxHash,
      url: getShelbyPublicUrl(upload.cid),
      mimeType: upload.mimeType,
      size: upload.size,
      message: "File uploaded to Shelby",
    });
  } catch (e) {
    console.error("Shelby upload:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Upload failed" },
      { status: 500 }
    );
  }
}
