import { prisma } from "@/lib/db";

export type LibraryActivityType = "UPLOAD" | "PURCHASE" | "DOWNLOAD" | "DELETE";

export async function recordLibraryActivity(input: {
  userId: string;
  type: LibraryActivityType;
  title: string;
  assetId?: string;
  productId?: string;
  amountApt?: number;
}) {
  try {
    return await prisma.libraryActivity.create({
      data: {
        userId: input.userId,
        type: input.type,
        title: input.title,
        assetId: input.assetId,
        productId: input.productId,
        amountApt: input.amountApt,
      },
    });
  } catch {
    return null;
  }
}