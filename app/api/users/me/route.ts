import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getShelbyPublicUrl } from "@/lib/shelby";

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

  if (username) {
    const taken = await prisma.user.findFirst({
      where: { username, NOT: { id: user.id } },
    });
    if (taken) {
      return NextResponse.json({ error: "Username taken" }, { status: 409 });
    }
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: {
      username: username || undefined,
      displayName: displayName || undefined,
      bio: bio || undefined,
      avatarCid: avatarCid || undefined,
      avatarUrl: avatarCid ? getShelbyPublicUrl(avatarCid) : undefined,
      bannerCid: bannerCid || undefined,
      bannerUrl: bannerCid ? getShelbyPublicUrl(bannerCid) : undefined,
      skills: Array.isArray(skills) ? skills : undefined,
      twitterUrl: twitterUrl || undefined,
      instagramUrl: instagramUrl || undefined,
      behanceUrl: behanceUrl || undefined,
      dribbbleUrl: dribbbleUrl || undefined,
      artstationUrl: artstationUrl || undefined,
      youtubeUrl: youtubeUrl || undefined,
      websiteUrl: websiteUrl || undefined,
      isCreator: isCreator === true ? true : undefined,
      handle: username || undefined,
      avatarRef: avatarCid || undefined,
      bannerRef: bannerCid || undefined,
    },
  });

  return NextResponse.json({ user: updated });
}
