import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim() || "";
  const category = searchParams.get("category") || "all";
  const sort = searchParams.get("sort") || "recent";
  const minPrice = searchParams.get("minPrice");
  const maxPrice = searchParams.get("maxPrice");
  const assetType = searchParams.get("type");
  const section = searchParams.get("section");

  const where: Record<string, unknown> = {
    status: "published",
    visibility: "public",
    isListed: true,
    // Private vault assets should not appear in public explorer (per owner putting asset in private vault)
    vaultAssets: {
      none: {
        vault: {
          visibility: "private",
        },
      },
    },
  };

  if (category !== "all") {
    where.OR = [
      { category: category },
      { tags: { has: category } },
    ];
  }

  if (assetType) where.assetType = assetType;

  if (minPrice != null || maxPrice != null) {
    const priceFilter: Record<string, number> = {};
    if (minPrice) priceFilter.gte = Number(minPrice);
    if (maxPrice) priceFilter.lte = Number(maxPrice);
    where.priceApt = priceFilter;
  }

  if (q) {
    where.AND = [
      {
        OR: [
          { title: { contains: q } },
          { description: { contains: q } },
          { tags: { has: q } },
        ],
      },
    ];
  }

  let orderBy: Record<string, string> = { createdAt: "desc" };
  if (sort === "popular") orderBy = { purchaseCount: "desc" };
  if (sort === "views") orderBy = { viewCount: "desc" };
  if (sort === "price_asc") orderBy = { priceApt: "asc" };
  if (sort === "price_desc") orderBy = { priceApt: "desc" };

  const take = section ? 8 : 40;
  const skip = Number(searchParams.get("skip") || "0");

  const assets = await prisma.asset.findMany({
    where,
    include: {
      owner: {
        select: {
          id: true,
          username: true,
          displayName: true,
          avatarUrl: true,
          walletAddress: true,
          address: true,
          creatorProfile: { select: { handle: true, reputationLevel: true } },
        },
      },
      metadata: { select: { summary: true, suggestedCategory: true } },
    },
    // thumbnailRef and blobRef are top level on Asset model - returned automatically
    orderBy,
    take,
    skip: isNaN(skip) ? 0 : skip,
  });

  const trending = section === "trending"
    ? assets
    : await prisma.asset.findMany({
        where: { 
          status: "published", 
          visibility: "public",
          isListed: true,
          vaultAssets: {
            none: {
              vault: {
                visibility: "private",
              },
            },
          },
        },
        orderBy: { purchaseCount: "desc" },
        take: 8,
        include: {
          owner: {
            select: {
              displayName: true,
              username: true,
              walletAddress: true,
              address: true,
              creatorProfile: { select: { handle: true } },
            },
          },
        },
      });

  const featured = section === "featured"
    ? assets.filter((a) => a.priceApt > 0).slice(0, 8)
    : await prisma.asset.findMany({
        where: { 
          status: "published", 
          visibility: "public", 
          isListed: true,
          priceApt: { gt: 0 },
          vaultAssets: {
            none: {
              vault: {
                visibility: "private",
              },
            },
          },
        },
        orderBy: { viewCount: "desc" },
        take: 8,
        include: {
          owner: {
            select: { displayName: true, username: true, walletAddress: true, address: true },
          },
        },
      });

  return NextResponse.json({
    assets,
    trending,
    featured,
    recent: assets,
  });
}
