import { NextResponse } from "next/server";
import { getSessionUser, mapDbUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { parseBlobRef } from "@/lib/shelby-public";
import { profileMediaDbFields } from "@/lib/profile-media";

export async function PUT(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const {
    username,
    displayName,
    bio,
    avatarCid,
    bannerCid,
    avatarRef,
    bannerRef,
    skills,
    twitterUrl,
    instagramUrl,
    behanceUrl,
    dribbbleUrl,
    artstationUrl,
    youtubeUrl,
    websiteUrl,
    isCreator,
  } = body;

  const avatar = avatarRef || avatarCid;
  const banner = bannerRef || bannerCid;

  if (username) {
    const taken = await prisma.user.findFirst({
      where: { username, NOT: { id: user.id } },
    });
    if (taken) {
      return NextResponse.json({ error: "Username taken" }, { status: 409 });
    }
  }

  if (avatar && !parseBlobRef(avatar)) {
    return NextResponse.json(
      { error: "Avatar must be uploaded to Shelbynet (valid Shelby blob ref)" },
      { status: 400 }
    );
  }
  if (banner && !parseBlobRef(banner)) {
    return NextResponse.json(
      { error: "Banner must be uploaded to Shelbynet (valid Shelby blob ref)" },
      { status: 400 }
    );
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: {
      ...(username ? { username, handle: username } : {}),
      ...(displayName !== undefined ? { displayName: displayName || null } : {}),
      ...(bio !== undefined ? { bio: bio || null } : {}),
      ...(avatar ? profileMediaDbFields("avatar", avatar) : {}),
      ...(banner ? profileMediaDbFields("banner", banner) : {}),
      ...(Array.isArray(skills) ? { skills } : {}),
      ...(twitterUrl !== undefined ? { twitterUrl: twitterUrl || null } : {}),
      ...(instagramUrl !== undefined ? { instagramUrl: instagramUrl || null } : {}),
      ...(behanceUrl !== undefined ? { behanceUrl: behanceUrl || null } : {}),
      ...(dribbbleUrl !== undefined ? { dribbbleUrl: dribbbleUrl || null } : {}),
      ...(artstationUrl !== undefined ? { artstationUrl: artstationUrl || null } : {}),
      ...(youtubeUrl !== undefined ? { youtubeUrl: youtubeUrl || null } : {}),
      ...(websiteUrl !== undefined ? { websiteUrl: websiteUrl || null } : {}),
      ...(isCreator === true ? { isCreator: true } : {}),
    },
  });

  return NextResponse.json({ user: mapDbUser(updated) });
}