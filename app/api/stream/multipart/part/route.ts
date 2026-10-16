import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getPresignedPartUrl } from "@/lib/s3";
import { z } from "zod";

const partSchema = z.object({
  key: z.string().min(1).max(1_024),
  uploadId: z.string().min(1).max(1_024),
  partNumber: z.coerce.number().int().min(1).max(10_000),
});

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = partSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "key, uploadId and partNumber required" }, { status: 400 });
  }
  const { key, uploadId, partNumber } = parsed.data;
  if (!key.startsWith(`streams/${user.id}/`)) {
    return NextResponse.json({ error: "Forbidden upload key" }, { status: 403 });
  }

  try {
    const uploadUrl = await getPresignedPartUrl(key, uploadId, partNumber);
    return NextResponse.json({ uploadUrl });
  } catch (e) {
    console.error("Part presign error", e);
    return NextResponse.json({ error: "Failed to presign part" }, { status: 500 });
  }
}
