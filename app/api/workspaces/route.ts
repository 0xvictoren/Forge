import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { createNotification } from "@/lib/notifications";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const workspaces = await prisma.workspace.findMany({
    where: {
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
      owner: { select: { displayName: true, username: true } },
    },
    orderBy: { updatedAt: "desc" },
  });

  return NextResponse.json({ workspaces });
}

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  if (!body.name) {
    return NextResponse.json({ error: "Name required" }, { status: 400 });
  }

  const workspace = await prisma.workspace.create({
    data: {
      name: body.name,
      description: body.description,
      ownerId: user.id,
      clientId: body.clientId,
      members: {
        create: [{ userId: user.id, role: "OWNER" }],
      },
    },
  });

  if (body.clientId && body.clientId !== user.id) {
    await prisma.workspaceMember.create({
      data: {
        workspaceId: workspace.id,
        userId: body.clientId,
        role: "CLIENT",
      },
    });
    await createNotification({
      userId: body.clientId,
      type: "WORKSPACE_INVITE",
      title: "Workspace invite",
      body: `${user.displayName || user.username || "Someone"} invited you to "${body.name}"`,
      href: `/workspaces/${workspace.id}`,
    });
  }

  return NextResponse.json({ workspace });
}
