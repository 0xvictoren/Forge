import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = (body.email as string)?.trim().toLowerCase();

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Valid email required" }, { status: 400 });
    }

    const existing = await prisma.waitlistEntry.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ ok: true, message: "Already on waitlist" });
    }

    await prisma.waitlistEntry.create({ data: { email } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("Waitlist error:", e);
    return NextResponse.json({ error: "Failed to join waitlist" }, { status: 500 });
  }
}