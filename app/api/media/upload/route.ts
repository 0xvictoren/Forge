import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";

/** Shelby blob registration must be signed by the connected wallet (client-side). */
export async function POST() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json(
    {
      error:
        "Server-side Shelby upload is disabled. Connect your wallet and upload from the app, your wallet pays the registration fee.",
    },
    { status: 403 }
  );
}