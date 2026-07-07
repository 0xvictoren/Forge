import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getShelbyPublicUrl } from "@/lib/shelby";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q") || "";
  const type = searchParams.get("type") || "all";
  const take = 20;

  const results: {
    type: string;
    id: string;
    title: string;
    subtitle?: string;
    href: string;
    image?: string;
  }[] = [];

  if (type === "all" || type === "creators" || type === "skills") {
    const users = await prisma.user.findMany({
      where: {
        isCreator: true,
        OR: q
          ? [
              { username: { contains: q } },
              { displayName: { contains: q } },
              { bio: { contains: q } },
              { skills: { has: q } },
            ]
          : undefined,
      },
      take,
      include: { creatorProfile: true },
    });
    for (const u of users) {
      results.push({
        type: "creator",
        id: u.id,
        title: u.displayName || u.username || "",
        subtitle: u.skills.join(", ") || u.bio || undefined,
        href: `/${u.username || u.creatorProfile?.handle}`,
        image: u.avatarUrl || undefined,
      });
    }
  }

  if (type === "all" || type === "burnlinks") {
    const links = await prisma.burnLink.findMany({
      where: q
        ? { OR: [{ title: { contains: q } }, { slug: { contains: q } }] }
        : undefined,
      take,
      include: { owner: true },
    });
    for (const l of links) {
      results.push({
        type: "burnlink",
        id: l.id,
        title: l.title || l.slug,
        subtitle: `@${l.owner.username}`,
        href: `/b/${l.slug}`,
      });
    }
  }

  if (type === "all" || type === "assets") {
    const content = await prisma.creatorContent.findMany({
      where: q ? { title: { contains: q } } : undefined,
      take,
      include: { creator: { include: { user: true } } },
    });
    for (const c of content) {
      results.push({
        type: "asset",
        id: c.id,
        title: c.title,
        subtitle: c.category || c.contentType,
        href: `/${c.creator.handle}`,
        image: c.thumbnailCid
          ? getShelbyPublicUrl(c.thumbnailCid)
          : getShelbyPublicUrl(c.shelbyCid),
      });
    }
  }

  return NextResponse.json({ results: results.slice(0, take) });
}
