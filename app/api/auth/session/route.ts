import { NextResponse } from "next/server";
import { createSession } from "@/lib/auth";
import { findOrCreateWalletUser } from "@/lib/find-or-create-user";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const walletAddress = body.walletAddress || body.address;
    if (!walletAddress) {
      return NextResponse.json({ error: "Wallet required" }, { status: 400 });
    }

    const normalized = walletAddress.toLowerCase();

    const user = await findOrCreateWalletUser(normalized);

    await createSession(user.id, undefined, user.address || user.walletAddress || normalized);

    return NextResponse.json({
      user: {
        id: user.id,
        walletAddress: user.walletAddress || user.address,
        address: user.address || user.walletAddress,
        username: user.username,
        handle: user.handle || user.username,
        displayName: user.displayName,
        bio: user.bio,
        avatarUrl: user.avatarUrl,
        bannerUrl: user.bannerUrl,
        avatarCid: user.avatarRef || user.avatarCid,
        isCreator: user.isCreator,
        verified: user.verified,
      },
    });
  } catch (error) {
    console.error("Session error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function GET() {
  const { getSessionUser } = await import("@/lib/auth");
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ user: null });
  return NextResponse.json({ user });
}
