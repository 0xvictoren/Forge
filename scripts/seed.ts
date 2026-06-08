/**
 * Seed demo creators for /explore
 * Run: npx tsx scripts/seed.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const CREATORS = [
  {
    handle: "mayachen",
    displayName: "Maya Chen",
    bio: "Brand identity & visual systems",
    verified: true,
    tier: { name: "Pro", priceApt: 0.5 },
    content: {
      title: "Neon Brand Identity System",
      contentType: "IMAGE",
      priceApt: 0.5,
      accessLevel: 2,
    },
  },
  {
    handle: "alexrivera",
    displayName: "Alex Rivera",
    bio: "3D artist · product viz",
    verified: true,
    tier: { name: "Basic", priceApt: 0.25 },
    content: {
      title: "3D Product Visualization",
      contentType: "IMAGE",
      priceApt: 0,
      accessLevel: 0,
    },
  },
  {
    handle: "studiokova",
    displayName: "Studio Kova",
    bio: "UI/UX for fintech",
    verified: true,
    tier: { name: "VIP", priceApt: 1.2 },
    content: {
      title: "Mobile Banking UI Kit",
      contentType: "ZIP",
      priceApt: 1.2,
      accessLevel: 2,
    },
  },
];

async function main() {
  for (const c of CREATORS) {
    const wallet = `0x${c.handle.padEnd(64, "0").slice(0, 64)}`;

    let user = await prisma.user.findFirst({
      where: { OR: [{ username: c.handle }, { walletAddress: wallet }] },
    });

    if (user) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          username: c.handle,
          displayName: c.displayName,
          bio: c.bio,
          walletAddress: wallet,
          isCreator: true,
          verified: c.verified,
          avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${c.handle}`,
          bannerUrl: `https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=1200&q=80`,
        },
      });
    } else {
      user = await prisma.user.create({
        data: {
          username: c.handle,
          email: `${c.handle}@forge.demo`,
          displayName: c.displayName,
          bio: c.bio,
          walletAddress: wallet,
          isCreator: true,
          verified: c.verified,
          avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${c.handle}`,
          bannerUrl: `https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=1200&q=80`,
        },
      });
    }

    const profile = await prisma.creatorProfile.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        handle: c.handle,
        subscriberCount: Math.floor(Math.random() * 500) + 50,
        totalViews: Math.floor(Math.random() * 5000) + 500,
      },
      update: {},
    });

    await prisma.subscriptionTier.deleteMany({
      where: { creatorProfileId: profile.id },
    });
    await prisma.subscriptionTier.create({
      data: {
        creatorProfileId: profile.id,
        tierIndex: 0,
        name: c.tier.name,
        priceApt: c.tier.priceApt,
        perks: ["Exclusive drops", "DM access"],
      },
    });

    const existing = await prisma.creatorContent.findFirst({
      where: { creatorProfileId: profile.id, title: c.content.title },
    });
    if (!existing) {
      await prisma.creatorContent.create({
        data: {
          creatorProfileId: profile.id,
          title: c.content.title,
          contentType: c.content.contentType,
          shelbyCid: `seed-${c.handle}-content`,
          thumbnailCid: `seed-${c.handle}-thumb`,
          accessLevel: c.content.accessLevel,
          priceApt: c.content.priceApt,
          viewCount: Math.floor(Math.random() * 10000) + 1000,
          purchaseCount: Math.floor(Math.random() * 200),
        },
      });
    }
  }

  console.log("Seeded", CREATORS.length, "creators");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
