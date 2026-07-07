import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  const certificate = await prisma.certificate.findUnique({
    where: { verificationSlug: slug },
    include: {
      buyer: { select: { displayName: true, username: true, walletAddress: true } },
      seller: { select: { displayName: true, username: true } },
      asset: true,
      product: true,
      purchase: true,
    },
  });

  if (!certificate) {
    return NextResponse.json({ error: "Certificate not found" }, { status: 404 });
  }

  return NextResponse.json({
    certificate,
    verified: true,
  });
}
