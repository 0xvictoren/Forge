import { NextResponse } from "next/server";
import { createSession, mapDbUser } from "@/lib/auth";
import { findOrCreateWalletUser } from "@/lib/find-or-create-user";
import {
  clearWalletLoginChallenge,
  verifySignedWalletLogin,
} from "@/lib/wallet-auth";

export async function POST(request: Request) {
  try {
    const verification = await verifySignedWalletLogin(await request.json());
    if (!verification.ok) {
      return NextResponse.json({ error: verification.error }, { status: 401 });
    }

    const user = await findOrCreateWalletUser(verification.walletAddress);

    await createSession(
      user.id,
      undefined,
      user.address || user.walletAddress || verification.walletAddress
    );
    await clearWalletLoginChallenge();

    return NextResponse.json(
      { user: mapDbUser(user) },
      { headers: { "Cache-Control": "no-store" } }
    );
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
