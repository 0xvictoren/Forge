import { prisma } from "@/lib/db";

const HANDLE_RE = /^[a-zA-Z0-9_]{3,24}$/;

export function normalizeHandle(handle: string): string {
  return handle.trim().toLowerCase();
}

export function isValidHandleFormat(handle: string): boolean {
  return HANDLE_RE.test(handle.trim());
}

/** True if another user already owns this handle (username, handle, or creator profile). */
export async function isHandleTaken(
  handle: string,
  excludeUserId?: string
): Promise<boolean> {
  const normalized = normalizeHandle(handle);
  if (!normalized) return false;

  const notSelf = excludeUserId ? { NOT: { id: excludeUserId } } : {};
  const notSelfProfile = excludeUserId ? { NOT: { userId: excludeUserId } } : {};

  const [userMatch, profileMatch] = await Promise.all([
    prisma.user.findFirst({
      where: {
        ...notSelf,
        OR: [{ username: normalized }, { handle: normalized }],
      },
      select: { id: true },
    }),
    prisma.creatorProfile.findFirst({
      where: {
        ...notSelfProfile,
        handle: normalized,
      },
      select: { id: true },
    }),
  ]);

  return !!(userMatch || profileMatch);
}