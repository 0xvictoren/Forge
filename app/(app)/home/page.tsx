import Link from "next/link";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatApt, truncateAddress } from "@/lib/utils";
import { Flame, Link2, Users, MessageSquare } from "lucide-react";

export default async function HomePage() {
  const user = await getSessionUser();
  const name =
    user?.displayName ||
    user?.username ||
    (user?.walletAddress ? truncateAddress(user.walletAddress) : "Creator");

  let burnLinks: Awaited<
    ReturnType<
      typeof prisma.burnLink.findMany<{
        include: { file: true };
      }>
    >
  > = [];
  let stats = { earned: 0, links: 0, subscribers: 0 };

  if (user) {
    try {
      burnLinks = await prisma.burnLink.findMany({
        where: { userId: user.id },
        include: { file: true },
        orderBy: { createdAt: "desc" },
        take: 10,
      });
      const txs = await prisma.transaction.aggregate({
        where: { userId: user.id, direction: "IN" },
        _sum: { amountApt: true },
      });
      stats.earned = txs._sum.amountApt || 0;
      stats.links = burnLinks.length;
      if (user.isCreator) {
        const profile = await prisma.creatorProfile.findUnique({
          where: { userId: user.id },
        });
        stats.subscribers = profile?.subscriberCount || 0;
      }
    } catch {
      /* db unavailable */
    }
  }

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="text-2xl font-bold">Welcome back, {name}</h1>

      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          { label: "Total Earned", value: formatApt(stats.earned), icon: Flame },
          { label: "Active Links", value: String(stats.links), icon: Link2 },
          { label: "Subscribers", value: String(stats.subscribers), icon: Users },
          { label: "Unread DMs", value: "0", icon: MessageSquare },
        ].map(({ label, value, icon: Icon }) => (
          <div key={label} className="card p-4">
            <Icon className="h-4 w-4 text-[var(--accent)]" />
            <p className="mt-2 text-xs text-[var(--text-muted)]">{label}</p>
            <p className="text-lg font-bold">{value}</p>
          </div>
        ))}
      </div>

      <section className="mt-10">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl">Your BurnLinks</h2>
          <Link href="/upload" className="btn-accent-ghost text-sm">
            + New
          </Link>
        </div>
        {burnLinks.length === 0 ? (
          <div className="card mt-4 flex flex-col items-center py-16 text-center">
            <Link2 className="h-12 w-12 text-[var(--text-muted)]" />
            <p className="mt-4 text-[var(--text-secondary)]">
              Share your first file
            </p>
            <Link href="/upload" className="btn-primary mt-4">
              Create BurnLink
            </Link>
          </div>
        ) : (
          <ul className="mt-4 space-y-3">
            {burnLinks.map((link) => (
              <li key={link.id}>
                <Link
                  href={`/b/${link.slug}`}
                  className="card flex items-center justify-between p-4 hover:border-[var(--border-accent)]"
                >
                  <div>
                    <p className="font-medium">
                      {link.title || link.file.fileName}
                    </p>
                    <p className="text-xs text-[var(--text-muted)]">
                      /b/{link.slug} · {link.viewCount} views
                    </p>
                  </div>
                  {link.priceApt > 0 ? (
                    <span className="badge badge-paid">
                      {formatApt(link.priceApt, 2)}
                    </span>
                  ) : (
                    <span className="badge badge-free">Free</span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
