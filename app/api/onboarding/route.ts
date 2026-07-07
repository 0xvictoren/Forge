import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, mapDbUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { parseBlobRef } from "@/lib/shelby-public";
import { profileMediaDbFields } from "@/lib/profile-media";
import { isHandleTaken, isValidHandleFormat, normalizeHandle } from "@/lib/username";

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user?.walletAddress && !user?.address) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const {
    handle,
    displayName,
    bio,
    avatarRef,
    bannerRef,
    avatarCid,
    bannerCid,
    skills,
    socials,
    twitterUrl,
    instagramUrl,
    behanceUrl,
    dribbbleUrl,
    artstationUrl,
  } = body;

  const username = handle || undefined;
  const avatar = avatarRef || avatarCid;
  const banner = bannerRef || bannerCid;

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { lastProfileEdit: true, username: true },
  });

  const handleChanging = !!(username && username !== dbUser?.username);
  if (handleChanging && dbUser?.lastProfileEdit) {
    const oneMonthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    if (dbUser.lastProfileEdit > oneMonthAgo) {
      return NextResponse.json(
        { error: "Handle changes are limited to once per month" },
        { status: 429 }
      );
    }
  }

  if (username) {
    if (!isValidHandleFormat(username)) {
      return NextResponse.json({ error: "Handle must be 3–24 characters (letters, numbers, underscore)" }, { status: 400 });
    }
    if (await isHandleTaken(username, user.id)) {
      return NextResponse.json({ error: "Handle taken" }, { status: 409 });
    }
  }

  if (avatar && !parseBlobRef(avatar)) {
    return NextResponse.json({ error: "Avatar must be a valid Shelby blob reference" }, { status: 400 });
  }
  if (banner && !parseBlobRef(banner)) {
    return NextResponse.json({ error: "Banner must be a valid Shelby blob reference" }, { status: 400 });
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: {
      ...(username ? { username: normalizeHandle(username), handle: normalizeHandle(username) } : {}),
      ...(displayName !== undefined ? { displayName: displayName || null } : {}),
      ...(bio !== undefined ? { bio: bio || null } : {}),
      ...(avatar ? profileMediaDbFields("avatar", avatar) : {}),
      ...(banner ? profileMediaDbFields("banner", banner) : {}),
      skills: Array.isArray(skills) ? skills : undefined,
      ...(socials?.x || socials?.twitter || twitterUrl
        ? { twitterUrl: socials?.x || socials?.twitter || twitterUrl }
        : {}),
      ...(socials?.instagram || instagramUrl
        ? { instagramUrl: socials?.instagram || instagramUrl }
        : {}),
      ...(socials?.behance || behanceUrl
        ? { behanceUrl: socials?.behance || behanceUrl }
        : {}),
      ...(socials?.dribbble || dribbbleUrl
        ? { dribbbleUrl: socials?.dribbble || dribbbleUrl }
        : {}),
      ...(socials?.artstation || artstationUrl
        ? { artstationUrl: socials?.artstation || artstationUrl }
        : {}),
      isCreator: true,
      ...(handleChanging ? { lastProfileEdit: new Date() } : {}),
    },
  });

  if (username) {
    await prisma.creatorProfile.upsert({
      where: { userId: user.id },
      create: { userId: user.id, handle: normalizeHandle(username) },
      update: { handle: normalizeHandle(username) },
    });
  }

  return NextResponse.json({ success: true, user: mapDbUser(updated), handle: updated.username });
}