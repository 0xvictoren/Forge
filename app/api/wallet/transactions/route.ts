import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const page = Number(searchParams.get("page") || 1);
  const type = searchParams.get("type");
  const direction = searchParams.get("direction");
  const take = 50;
  const skip = (page - 1) * take;

  const where: {
    userId: string;
    type?: string;
    direction?: string;
  } = { userId: user.id };

  if (type && type !== "ALL") where.type = type;
  if (direction && direction !== "ALL") where.direction = direction;

  const [transactions, total] = await Promise.all([
    prisma.transaction.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take,
    }),
    prisma.transaction.count({ where }),
  ]);

  return NextResponse.json({ transactions, total, page });
}
