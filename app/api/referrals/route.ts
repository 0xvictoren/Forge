import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

function defaultCode(user: { username?: string | null; handle?: string | null; id: string }) {
  const base = user.username || user.handle || user.id.slice(-8);
  return base.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 20) || `ref${user.id.slice(-6)}`;
}

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let referral = await prisma.referralCode.findUnique({ where: { userId: user.id } });
  if (!referral) {
    const code = defaultCode(user);
    referral = await prisma.referralCode.create({
      data: { userId: user.id, code },
    });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const events = await prisma.referralEvent.findMany({
    where: { code: referral.code },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  return NextResponse.json({
    referral,
    link: `${appUrl}/?ref=${referral.code}`,
    events,
  });
}

export async function POST(request: Request) {
  const body = await request.json();
  const code = body.code as string;
  const eventType = (body.eventType as string) || "VISIT";

  if (!code) {
    return NextResponse.json({ error: "code required" }, { status: 400 });
  }

  const referral = await prisma.referralCode.findUnique({ where: { code } });
  if (!referral) {
    return NextResponse.json({ error: "Invalid code" }, { status: 404 });
  }

  await prisma.referralEvent.create({
    data: {
      code,
      eventType,
      amountApt: body.amountApt,
      referredUserId: body.referredUserId,
    },
  });

  const updates: Record<string, { increment: number }> = {};
  if (eventType === "VISIT") updates.visits = { increment: 1 };
  if (eventType === "SIGNUP") updates.signups = { increment: 1 };
  if (eventType === "PURCHASE") {
    updates.purchases = { increment: 1 };
    if (body.amountApt) {
      await prisma.referralCode.update({
        where: { code },
        data: {
          purchases: { increment: 1 },
          revenueApt: { increment: Number(body.amountApt) },
        },
      });
      return NextResponse.json({ ok: true });
    }
  }

  if (Object.keys(updates).length) {
    await prisma.referralCode.update({ where: { code }, data: updates });
  }

  return NextResponse.json({ ok: true });
}
