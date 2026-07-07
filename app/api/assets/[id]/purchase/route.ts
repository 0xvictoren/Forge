import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { verifyAndPurchaseAsset } from "@/lib/v2/purchase";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await request.json();
  const txHash = body.txHash as string;
  const walletAddress = (body.walletAddress || user.walletAddress || user.address) as string;

  if (!txHash?.startsWith("0x")) {
    return NextResponse.json({ error: "Transaction hash required" }, { status: 400 });
  }

  try {
    const result = await verifyAndPurchaseAsset({
      buyerId: user.id,
      assetId: id,
      txHash,
      walletAddress,
    });

    return NextResponse.json({
      purchase: result.purchase,
      certificate: result.certificate,
      verificationUrl: result.certificate
        ? `/cert/${result.certificate.verificationSlug}`
        : null,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Purchase failed" },
      { status: 400 }
    );
  }
}
