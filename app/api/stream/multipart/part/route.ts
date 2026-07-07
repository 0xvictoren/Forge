import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getPresignedPartUrl } from "@/lib/s3";

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { key, uploadId, partNumber } = await request.json();
  if (!key || !uploadId || !partNumber) {
    return NextResponse.json({ error: "key, uploadId and partNumber required" }, { status: 400 });
  }

  try {
    const uploadUrl = await getPresignedPartUrl(key, uploadId, Number(partNumber));
    return NextResponse.json({ uploadUrl });
  } catch (e) {
    console.error("Part presign error", e);
    return NextResponse.json({ error: "Failed to presign part" }, { status: 500 });
  }
}
