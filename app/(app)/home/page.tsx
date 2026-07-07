import Link from "next/link";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatApt, truncateAddress } from "@/lib/utils";
import { getNotifications } from "@/lib/notifications";
import {
  Flame,
  Link2,
  MessageSquare,
  Bell,
  HardDrive,
  Briefcase,
  BookOpen,
  TrendingUp,
  Clock,
} from "lucide-react";
import { AssetCard } from "@/components/v2/asset-card";
import { HomeLive } from "@/components/v2/home-live";
import { t } from "@/lib/i18n/translations";

export default async function HomePage() {
  const user = await getSessionUser();
  const name =
    user?.displayName ||
    user?.username ||
    (user?.walletAddress ? truncateAddress(user.walletAddress) : "Creator");

  if (!user) return null;

  const [
    recentPurchases,
    recentUploads,
    recommended,
    activeSubs,
    workspaces,
    revenue,
    notifications,
    storageFiles,
    assetStorage,
    burnLinks,
    unreadDmEstimate,
  ] = await Promise.all([
    prisma.purchase.findMany({
      where: { buyerId: user.id },
      orderBy: { createdAt: "desc" },
      take: 4,
      include: { asset: true, certificate: true },
    }),
    prisma.asset.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 2, // max 2 recent uploads on home as per requirements
    }),
    prisma.asset.findMany({
      where: { status: "published", visibility: "public", userId: { not: user.id } },
      orderBy: { purchaseCount: "desc" },
      take: 6,
      include: {
        owner: {
          select: {
            displayName: true,
            username: true,
            creatorProfile: { select: { handle: true, reputationLevel: true } },
          },
        },
        metadata: { select: { summary: true } },
      },
    }), // thumbnailRef + blobRef are scalars, included automatically for cards
    prisma.subscriberGrant.findMany({
      where: { subscriberId: user.id, status: "active" },
      include: {
        tier: { include: { creator: { include: { user: { select: { displayName: true, username: true } } } } } },
      },
      take: 5,
      orderBy: { renewsAt: "asc" },
    }),
    prisma.workspace.count({
      where: {
        OR: [{ ownerId: user.id }, { members: { some: { userId: user.id } } }],
      },
    }),
    prisma.transaction.aggregate({
      where: { userId: user.id, direction: "IN" },
      _sum: { amountApt: true },
    }),
    getNotifications(user.id),
    prisma.file.aggregate({ where: { userId: user.id }, _sum: { fileSize: true } }),
    prisma.asset.aggregate({ where: { userId: user.id }, _sum: { fileSize: true } }),
    prisma.burnLink.findMany({
      where: { userId: user.id },
      include: { file: true },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    prisma.participant.count({ where: { userId: user.id } }),
  ]);

  const earned = revenue._sum.amountApt || 0;
  const storageBytes = (storageFiles._sum.fileSize || 0) + (assetStorage._sum.fileSize || 0);
  const storageMb = (storageBytes / (1024 * 1024)).toFixed(1);
  const unreadNotifications = notifications.filter((n) => !n.read).length;

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex flex-col gap-4 px-4 pb-2 lg:flex-row lg:items-end lg:justify-between lg:px-0">
        <div>
          <h1 className="font-serif text-3xl font-semibold tracking-tight">{t("en", "welcome_back", { name }) || `Welcome back, ${name}`}</h1>
          <p className="mt-1 text-[15px] text-[var(--text-secondary)]">{t("en", "what_matters_today") || "Here’s what’s happening with your work today."}</p>
        </div>
        <div className="flex gap-2 self-start lg:self-auto">
          <Link href="/dashboard" className="btn-ghost text-sm">Dashboard</Link>
          <Link href="/upload" className="btn-brand text-sm">{t("en", "upload") || "+ New asset"}</Link>
        </div>
      </div>

      {/* At-a-glance stats - Gumroad/Patreon dashboard inspired */}
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { labelKey: "revenue", defaultLabel: "Revenue earned", value: formatApt(earned), icon: Flame, hint: "all time" },
          { labelKey: "storage", defaultLabel: "Storage used", value: `${storageMb} MB`, icon: HardDrive, hint: "Shelby + indexed" },
          { labelKey: "subscriptions", defaultLabel: "Active subs", value: String(activeSubs.length), icon: TrendingUp, hint: "you follow" },
          { labelKey: "notifications", defaultLabel: "Unread", value: String(unreadNotifications), icon: Bell, hint: "notifications" },
        ].map(({ labelKey, defaultLabel, value, icon: Icon, hint }) => (
          <div key={labelKey} className="card p-4">
            <div className="flex items-center gap-2">
              <Icon className="h-4 w-4 text-[var(--accent)]" />
              <span className="text-xs uppercase tracking-widest text-[var(--text-muted)]">{t("en", labelKey) || defaultLabel}</span>
            </div>
            <p className="mt-2 text-2xl font-semibold tabular-nums">{value}</p>
            <p className="text-[10px] text-[var(--text-muted)]">{hint}</p>
          </div>
        ))}
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-2">
        <section>
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">{t("en", "recent_purchases") || "Recent purchases (Library)"}</h2>
            <Link href="/library" className="text-sm text-[var(--accent)]">{t("en", "library") || "Full library"} →</Link>
          </div>
          {recentPurchases.length === 0 ? (
            <p className="card mt-3 p-4 text-sm text-[var(--text-muted)]">
              Nothing in library yet. <Link href="/explore" className="text-[var(--accent)]">Discover assets</Link>
            </p>
          ) : (
            <ul className="mt-3 space-y-2">
              {recentPurchases.map((p) => (
                <li key={p.id} className="card flex items-center justify-between p-3 text-sm">
                  <span className="font-medium truncate pr-3">{p.asset?.title || "Asset purchase"}</span>
                  <span className="shrink-0 text-[var(--text-muted)]">{formatApt(p.amountApt)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">{t("en", "your_recent_uploads") || "Your recent uploads"}</h2>
            <Link href="/upload" className="text-sm text-[var(--accent)]">{t("en", "upload") || "Upload"} →</Link>
          </div>
          {recentUploads.length === 0 ? (
            <p className="card mt-3 p-4 text-sm text-[var(--text-muted)]">Upload your first asset to start selling or sharing.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {recentUploads.map((a) => (
                <li key={a.id}>
                  <Link href={`/assets/${a.id}`} className="card block p-3 text-sm font-medium hover:border-[var(--border-accent)]">{a.title}</Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* Active subscriptions with expiry - critical for membership flow */}
      {activeSubs.length > 0 && (
        <section className="mt-10">
          <h2 className="font-semibold">Active memberships</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {activeSubs.map((s) => (
              <div key={s.id} className="card p-4 text-sm">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-[var(--accent)]" />
                  <span className="font-medium">{s.tier?.name}</span>
                </div>
                <p className="mt-1 text-xs text-[var(--text-muted)]">
                  {s.tier?.creator?.user?.displayName || s.tier?.creator?.user?.username} • renews {new Date(s.renewsAt).toLocaleDateString()}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      {recommended.length > 0 && (
        <section className="mt-10">
          <h2 className="font-semibold">Recommended for you</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {recommended.map((a) => <AssetCard key={a.id} asset={a} />)}
          </div>
        </section>
      )}

      <div className="mt-10 grid gap-4 sm:grid-cols-3">
        <Link href="/workspaces" className="card flex items-center gap-3 p-4 hover:border-[var(--border-accent)]">
          <Briefcase className="h-5 w-5 text-[var(--accent)]" />
          <div>
            <p className="font-medium">Workspaces</p>
            <p className="text-xs text-[var(--text-muted)]">{workspaces} active</p>
          </div>
        </Link>
        <Link href="/chat" className="card flex items-center gap-3 p-4 hover:border-[var(--border-accent)]">
          <MessageSquare className="h-5 w-5 text-[var(--accent)]" />
          <div>
            <p className="font-medium">Messages</p>
            <p className="text-xs text-[var(--text-muted)]">{unreadDmEstimate} open</p>
          </div>
        </Link>
        <Link href="/library" className="card flex items-center gap-3 p-4 hover:border-[var(--border-accent)]">
          <BookOpen className="h-5 w-5 text-[var(--accent)]" />
          <div>
            <p className="font-medium">Library</p>
            <p className="text-xs text-[var(--text-muted)]">Downloads, certs, subs</p>
          </div>
        </Link>
      </div>

      {/* Real-time island + Burnlinks */}
      <section className="mt-10">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Your BurnLinks</h2>
          <Link href="/upload" className="btn-accent-ghost text-sm">+ New</Link>
        </div>
        {burnLinks.length === 0 ? (
          <div className="card mt-4 flex flex-col items-center py-10 text-center">
            <Link2 className="h-9 w-9 text-[var(--text-muted)]" />
            <p className="mt-3 text-sm text-[var(--text-secondary)]">Share files with time/view limits and paywalls.</p>
            <Link href="/upload" className="btn-primary mt-4 text-sm">Create BurnLink</Link>
          </div>
        ) : (
          <ul className="mt-3 space-y-2">
            {burnLinks.map((link) => (
              <li key={link.id}>
                <Link href={`/b/${link.slug}`} className="card flex items-center justify-between p-3.5 text-sm hover:border-[var(--border-accent)]">
                  <div className="min-w-0 pr-3">
                    <p className="font-medium truncate">{link.title || link.file.fileName}</p>
                    <p className="text-xs text-[var(--text-muted)]">/b/{link.slug} · {link.viewCount} views</p>
                  </div>
                  {link.priceApt > 0 ? <span className="badge badge-paid">{formatApt(link.priceApt, 2)}</span> : <span className="badge badge-free">Free</span>}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Pusher-powered live updates for purchases, notifs etc. Fits "real-time" in spec */}
      <HomeLive userId={user.id} />
    </div>
  );
}
