import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { redactSensitiveResponse } from "@/lib/security-response";
import { z } from "zod";

const objectId = z.string().regex(/^[a-f0-9]{24}$/i);
const productCreateSchema = z.object({
  title: z.string().trim().min(1).max(160),
  description: z.string().trim().max(5_000).optional(),
  productType: z.string().trim().max(50).optional(),
  priceApt: z.number().finite().nonnegative().max(10_000).optional(),
  vaultId: objectId.optional(),
  thumbnailRef: z.string().trim().max(2_000).optional(),
  assetIds: z.array(objectId).max(100).default([]),
});
const productPatchSchema = z.object({
  productId: objectId,
  isListed: z.boolean().optional(),
  title: z.string().trim().min(1).max(160).optional(),
  description: z.string().trim().max(5_000).nullable().optional(),
  priceApt: z.number().finite().nonnegative().max(10_000).optional(),
  thumbnailRef: z.string().trim().max(2_000).nullable().optional(),
  addAssetIds: z.array(objectId).max(100).default([]),
  removeAssetIds: z.array(objectId).max(100).default([]),
});

async function ownsAssets(userId: string, assetIds: string[]) {
  if (!assetIds.length) return true;
  const uniqueIds = [...new Set(assetIds)];
  const count = await prisma.asset.count({
    where: { id: { in: uniqueIds }, userId },
  });
  return count === uniqueIds.length;
}

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

  return NextResponse.json({
    products: redactSensitiveResponse(products, { redactStorageReferences: true }),
  });
}

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = productCreateSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid product input" }, { status: 400 });
  }
  const body = parsed.data;

  if (!(await ownsAssets(user.id, body.assetIds))) {
    return NextResponse.json(
      { error: "Products may only contain assets you own" },
      { status: 403 }
    );
  }
  if (body.vaultId) {
    const vault = await prisma.vault.findUnique({
      where: { id: body.vaultId },
      select: { userId: true },
    });
    if (!vault || vault.userId !== user.id) {
      return NextResponse.json({ error: "Invalid vault" }, { status: 403 });
    }
  }

  const product = await prisma.product.create({
    data: {
      userId: user.id,
      title: body.title,
      description: body.description,
      productType: body.productType || "BUNDLE",
      priceApt: body.priceApt || 0,
      vaultId: body.vaultId,
      thumbnailRef: body.thumbnailRef,
      isListed: false, // user must explicitly list before it appears in explorer
      items: body.assetIds.length
        ? {
            create: body.assetIds.map((assetId, i) => ({
              assetId,
              sortOrder: i,
            })),
          }
        : undefined,
    },
    include: { items: true },
  });

  return NextResponse.json({
    product: redactSensitiveResponse(product, { redactStorageReferences: true }),
  });
}

export async function PATCH(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = productPatchSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid product update" }, { status: 400 });
  }
  const {
    productId,
    isListed,
    title,
    description,
    priceApt,
    thumbnailRef,
    addAssetIds = [],
    removeAssetIds = [],
  } = parsed.data;

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
      if (!(await ownsAssets(user.id, newAdds))) {
        return NextResponse.json(
          { error: "Products may only contain assets you own" },
          { status: 403 }
        );
      }
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

  return NextResponse.json({
    product: redactSensitiveResponse(updated, { redactStorageReferences: true }),
  });
}
