import { prisma } from "@/lib/db";
import type { User } from "@prisma/client";
import { randomBytes } from "crypto";

/** Derive a unique placeholder username from wallet — avoids null username collisions. */
function walletPlaceholderUsername(address: string, suffix = ""): string {
  const hex = address.replace(/^0x/i, "").toLowerCase();
  const base = `w_${hex}`;
  return suffix ? `${base}_${suffix}` : base;
}

/**
 * Find or create a user by wallet address.
 * Never writes `username: null` (MongoDB unique index treats duplicate nulls as conflicts).
 */
export async function findOrCreateWalletUser(walletAddress: string): Promise<User> {
  const normalized = walletAddress.trim().toLowerCase();

  const existing = await prisma.user.findFirst({
    where: {
      OR: [{ walletAddress: normalized }, { address: normalized }],
    },
  });

  if (existing) {
    if (!existing.walletAddress || !existing.address) {
      return prisma.user.update({
        where: { id: existing.id },
        data: {
          walletAddress: existing.walletAddress || normalized,
          address: existing.address || normalized,
        },
      });
    }
    return existing;
  }

  for (let attempt = 0; attempt < 3; attempt++) {
    const suffix = attempt === 0 ? "" : randomBytes(4).toString("hex");
    const placeholder = walletPlaceholderUsername(normalized, suffix);

    try {
      return await prisma.user.create({
        data: {
          walletAddress: normalized,
          address: normalized,
          username: placeholder,
          handle: placeholder,
        },
      });
    } catch {
      const retry = await prisma.user.findFirst({
        where: {
          OR: [{ walletAddress: normalized }, { address: normalized }],
        },
      });
      if (retry) return retry;
    }
  }

  throw new Error("Could not create user for wallet");
}
