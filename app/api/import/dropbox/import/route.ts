import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";

/** Shelby registration must happen client-side via connected wallet. */
export async function POST() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json(
    {
      error:
        "Server-side Shelby upload is disabled. Connect your wallet and import via the client uploader.",
    },
    { status: 403 }
  );
}