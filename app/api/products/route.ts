import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");
  const sessionUser = await getSessionUser();

  let where: any = { isActive: true };
  if (userId === "me" && sessionUser) {
    where.userId = sessionUser.id;
  } else if (userId) {
    where.userId = userId;
  } else if (sessionUser) {
    // For logged in, show public listed + own (for bundles page to see unlisted own)
    where.OR = [
      { isListed: true },
      { userId: sessionUser.id },
    ];
  } else {
    where.isListed = true;
  }

  const products = await prisma.product.findMany({
    where,
    include: {
      items: { include: { asset: true } },
      owner: { select: { displayName: true, username: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 30,
  });

  return NextResponse.json({ products });
}

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  if (!body.title) {
    return NextResponse.json({ error: "Title required" }, { status: 400 });
  }

  const product = await prisma.product.create({
    data: {
      userId: user.id,
      title: body.title,
      description: body.description,
      productType: body.productType || "BUNDLE",
      priceApt: Number(body.priceApt || 0),
      vaultId: body.vaultId,
      thumbnailRef: body.thumbnailRef,
      isListed: false, // user must explicitly list before it appears in explorer
      items: body.assetIds?.length
        ? {
            create: (body.assetIds as string[]).map((assetId: string, i: number) => ({
              assetId,
              sortOrder: i,
            })),
          }
        : undefined,
    },
    include: { items: true },
  });

  return NextResponse.json({ product });
}

export async function PATCH(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const {
    productId,
    isListed,
    title,
    description,
    priceApt,
    thumbnailRef,
    addAssetIds = [],
    removeAssetIds = [],
  } = body;

  if (!productId) return NextResponse.json({ error: "productId required" }, { status: 400 });

  const product = await prisma.product.findUnique({ where: { id: productId }, include: { items: true } });
  if (!product || product.userId !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const updateData: any = {};
  if (typeof isListed === "boolean") updateData.isListed = isListed;
  if (title) updateData.title = title;
  if (description !== undefined) updateData.description = description;
  if (typeof priceApt === "number") updateData.priceApt = priceApt;
  if (thumbnailRef !== undefined) updateData.thumbnailRef = thumbnailRef || null;

  // Handle add/remove items (assets)
  if (addAssetIds.length > 0 || removeAssetIds.length > 0) {
    // Remove
    if (removeAssetIds.length) {
      await prisma.productItem.deleteMany({
        where: { productId, assetId: { in: removeAssetIds } },
      });
    }
    // Add new, avoid duplicates
    const existingAssetIds = new Set(product.items.map(i => i.assetId).filter(Boolean));
    const newAdds = addAssetIds.filter((aid: string) => !existingAssetIds.has(aid));
    if (newAdds.length) {
      await prisma.productItem.createMany({
        data: newAdds.map((assetId: string, i: number) => ({
          productId,
          assetId,
          sortOrder: product.items.length + i,
        })),
      });
    }
  }

  const updated = await prisma.product.update({
    where: { id: productId },
    data: updateData,
    include: { items: { include: { asset: true } } },
  });

  return NextResponse.json({ product: updated });
}
