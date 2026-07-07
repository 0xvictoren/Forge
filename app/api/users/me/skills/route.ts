import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function PUT(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { skills } = await request.json();
  if (!Array.isArray(skills)) {
    return NextResponse.json({ error: "skills must be an array" }, { status: 400 });
  }

  const cleaned = skills
    .map((s: unknown) => (typeof s === "string" ? s.trim() : ""))
    .filter(Boolean)
    .slice(0, 20);

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { skills: cleaned },
  });

  return NextResponse.json({ skills: updated.skills });
}
