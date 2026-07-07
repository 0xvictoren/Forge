import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { truncateAddress } from "@/lib/utils";
import { VerifiedBadge } from "@/components/profile/verified-badge";
import { resolveAvatarUrl, resolveBannerUrl } from "@/lib/profile-media";

export default async function ProfilePage() {
  const user = await getSessionUser();
  if (!user) redirect("/");

  const full = await prisma.user.findUnique({
    where: { id: user.id },
    select: {
      username: true,
      displayName: true,
      bio: true,
      avatarUrl: true,
      bannerUrl: true,
      avatarCid: true,
      avatarRef: true,
      bannerCid: true,
      bannerRef: true,
      verified: true,
      walletAddress: true,
      address: true,
      skills: true,
      twitterUrl: true,
      instagramUrl: true,
      behanceUrl: true,
    },
  });

  if (!full) redirect("/");

  const handle = full.username;
  const wallet = full.walletAddress || full.address;
  const avatar = resolveAvatarUrl(full);
  const banner = resolveBannerUrl(full);

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-extrabold uppercase tracking-tight">Profile</h1>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            Your public creator identity on Forge.
          </p>
        </div>
        <Link href="/onboarding" className="btn-accent-ghost text-sm">
          Edit profile
        </Link>
      </div>

      <div className="card overflow-hidden p-0">
        <div className="relative h-32 bg-[var(--bg-subtle)] md:h-40">
          {banner && (
            <Image src={banner} alt="" fill className="object-cover" unoptimized />
          )}
        </div>

        <div className="relative px-6 pb-6">
          <div className="-mt-10 flex items-end gap-4">
            <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-full border-4 border-[var(--bg-elevated)] bg-[var(--bg-subtle)] shadow-sm">
              {avatar ? (
                <Image src={avatar} alt="" fill className="object-cover" unoptimized />
              ) : (
                <div className="flex h-full items-center justify-center text-2xl font-bold text-[var(--text-muted)]">
                  {(full.displayName || full.username || "?")[0]?.toUpperCase()}
                </div>
              )}
            </div>
            <div className="min-w-0 pb-1">
              <p className="flex items-center gap-2 text-xl font-semibold">
                {full.displayName || full.username || "Creator"}
                {full.verified && <VerifiedBadge />}
              </p>
              {handle && (
                <p className="text-sm text-[var(--text-muted)]">@{handle}</p>
              )}
            </div>
          </div>

          {wallet && (
            <p className="mt-3 font-mono text-xs text-[var(--text-secondary)]">
              {truncateAddress(wallet)}
            </p>
          )}

          {full.bio && (
            <p className="mt-4 text-sm text-[var(--text-secondary)]">{full.bio}</p>
          )}

          {full.skills.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {full.skills.map((skill) => (
                <span key={skill} className="badge badge-free text-xs">
                  {skill}
                </span>
              ))}
            </div>
          )}

          <div className="mt-6 flex flex-wrap gap-3">
            {handle && (
              <Link href={`/${handle}`} className="btn-primary text-sm">
                View public profile
              </Link>
            )}
            <Link href="/wallet" className="btn-accent-ghost text-sm">
              Wallet
            </Link>
            <Link href="/bundles" className="btn-accent-ghost text-sm">
              Bundles
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}