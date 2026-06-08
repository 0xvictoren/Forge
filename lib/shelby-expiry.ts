import "server-only";
import { prisma } from "./db";
import { deleteFromShelby } from "./shelby-server";

export async function purgeExpiredBurnLinks(limit = 20): Promise<number> {
  const now = new Date();
  const expired = await prisma.burnLink.findMany({
    where: {
      isActive: true,
      expiresAt: { lte: now },
    },
    take: limit,
    include: { file: true },
  });

  let purged = 0;
  for (const link of expired) {
    try {
      if (link.file?.blobId) {
        await deleteFromShelby(link.file.blobId);
      }
      await prisma.burnLink.update({
        where: { id: link.id },
        data: { isActive: false },
      });
      purged++;
    } catch (e) {
      console.error("purge burnlink", link.slug, e);
    }
  }
  return purged;
}

export async function ensureBurnLinkActive(
  burnLinkId: string
): Promise<{ ok: boolean; expired?: boolean }> {
  const link = await prisma.burnLink.findUnique({ where: { id: burnLinkId } });
  if (!link || !link.isActive) return { ok: false };
  if (link.expiresAt && link.expiresAt <= new Date()) {
    await purgeExpiredBurnLinks(1);
    return { ok: false, expired: true };
  }
  return { ok: true };
}
