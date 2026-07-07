import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(request: Request) {
  const session = await getSessionUser();
  const q = new URL(request.url).searchParams.get("q")?.replace(/^@/, "").trim() || "";
  if (!q || q.length < 2) {
    return NextResponse.json({ users: [] });
  }

  const users = await prisma.user.findMany({
    where: {
      AND: [
        session ? { NOT: { id: session.id } } : {},
        {
          OR: [
            { username: { contains: q } },
            { handle: { contains: q } },
            { displayName: { contains: q } },
          ],
        },
        { NOT: { username: { startsWith: "w_" } } },
        { username: { not: null } },
      ],
    },
    take: 20,
    select: {
      id: true,
      username: true,
      displayName: true,
      avatarUrl: true,
      bio: true,
    },
  });

  return NextResponse.json({ users });
}
