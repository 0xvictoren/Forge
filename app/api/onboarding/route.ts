import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getShelbyPublicUrl } from "@/lib/shelby";

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user?.walletAddress && !user?.address) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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
  } = await req.json();

  const username = handle || undefined;
  if (username) {
    const taken = await prisma.user.findFirst({
      where: { username, NOT: { id: user.id } },
    });
    if (taken) {
      return NextResponse.json({ error: "Handle taken" }, { status: 409 });
    }
  }

  const avatar = avatarRef || avatarCid;
  const banner = bannerRef || bannerCid;

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: {
      username,
      handle: username,
      displayName: displayName || undefined,
      bio: bio || undefined,
      avatarCid: avatar || undefined,
      avatarRef: avatar || undefined,
      avatarUrl: avatar ? getShelbyPublicUrl(avatar) : undefined,
      bannerCid: banner || undefined,
      bannerRef: banner || undefined,
      bannerUrl: banner ? getShelbyPublicUrl(banner) : undefined,
      skills: Array.isArray(skills) ? skills : [],
      twitterUrl: socials?.x || socials?.twitter || twitterUrl || undefined,
      instagramUrl: socials?.instagram || instagramUrl || undefined,
      behanceUrl: socials?.behance || behanceUrl || undefined,
      dribbbleUrl: socials?.dribbble || dribbbleUrl || undefined,
      artstationUrl: socials?.artstation || artstationUrl || undefined,
      isCreator: true,
    },
  });

  if (username) {
    await prisma.creatorProfile.upsert({
      where: { userId: user.id },
      create: { userId: user.id, handle: username },
      update: { handle: username },
    });
  }

  return NextResponse.json({ success: true, handle: updated.username });
}
