import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { parseWalletList } from "@/lib/wallet-access";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { slug } = await params;
  const burnLink = await prisma.burnLink.findUnique({ where: { slug } });
  if (!burnLink) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (burnLink.userId !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const walletGated =
    body.walletGated !== undefined ? !!body.walletGated : burnLink.walletGated;

  let allowedWallets = burnLink.allowedWallets;
  if (body.allowedWallets !== undefined) {
    if (Array.isArray(body.allowedWallets)) {
      allowedWallets = body.allowedWallets.map(String);
    } else if (typeof body.allowedWallets === "string") {
      allowedWallets = parseWalletList(body.allowedWallets);
    } else {
      allowedWallets = [];
    }
  }

  if (walletGated && allowedWallets.length === 0) {
    return NextResponse.json(
      { error: "Add at least one wallet when whitelist is enabled" },
      { status: 400 }
    );
  }

  const updated = await prisma.burnLink.update({
    where: { id: burnLink.id },
    data: { walletGated, allowedWallets },
  });

  return NextResponse.json({ burnLink: updated });
}
