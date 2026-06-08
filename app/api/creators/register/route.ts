import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { handle, tiers, skipTiers } = await request.json();

  if (!handle || !/^[a-zA-Z0-9_]{3,24}$/.test(handle)) {
    return NextResponse.json({ error: "Invalid handle" }, { status: 400 });
  }

  const taken = await prisma.creatorProfile.findUnique({ where: { handle } });
  if (taken && taken.userId !== user.id) {
    return NextResponse.json({ error: "Handle taken" }, { status: 409 });
  }

  let tierData = skipTiers
    ? []
    : (tiers || []).slice(0, 3).map(
        (
          t: { name: string; priceApt: number; perks?: string[]; description?: string },
          i: number
        ) => ({
          tierIndex: i,
          name: t.name || `Tier ${i + 1}`,
          priceApt: Number(t.priceApt) || 0,
          perks: t.perks || [],
          description: t.description || null,
        })
      );

  if (!skipTiers && tierData.length === 0) {
    tierData.push({
      tierIndex: 0,
      name: "Basic",
      priceApt: 0.5,
      perks: ["Exclusive content"],
      description: "Monthly access",
    });
  }

  const profile = await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: user.id },
      data: { username: handle, isCreator: true },
    });

    const p = await tx.creatorProfile.upsert({
      where: { userId: user.id },
      create: { userId: user.id, handle },
      update: { handle },
    });

    await tx.subscriptionTier.deleteMany({
      where: { creatorProfileId: p.id },
    });

    if (tierData.length > 0) {
      for (const tier of tierData) {
        await tx.subscriptionTier.create({
          data: { creatorProfileId: p.id, ...tier },
        });
      }
    }

    return p;
  });

  return NextResponse.json({ profile, handle: profile.handle });
}
