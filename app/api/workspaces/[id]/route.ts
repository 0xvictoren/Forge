import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const workspace = await prisma.workspace.findFirst({
    where: {
      id,
      OR: [
        { ownerId: user.id },
        { members: { some: { userId: user.id } } },
      ],
    },
    include: {
      members: {
        include: {
          user: { select: { id: true, displayName: true, username: true, avatarUrl: true } },
        },
      },
      owner: { select: { displayName: true, username: true, walletAddress: true } },
    },
  });

  if (!workspace) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const invoices = await prisma.invoice.findMany({
    where: {
      OR: [
        { issuerId: user.id, recipientId: workspace.clientId || undefined },
        { recipientId: user.id, issuerId: workspace.ownerId },
      ],
    },
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  return NextResponse.json({ workspace, invoices });
}
