import Link from "next/link";
import { notFound } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatApt } from "@/lib/utils";
import { VaultAssetAdder } from "@/components/v2/vault-asset-adder";

export default async function VaultDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getSessionUser();
  if (!user) return null;

  const { id } = await params;

  const vault = await prisma.vault.findFirst({
    where: {
      id,
      OR: [
        { userId: user.id },
        { members: { some: { userId: user.id } } },
        { isPublished: true },
      ],
    },
    include: {
      owner: { select: { displayName: true, username: true } },
      assets: {
        include: { asset: true },
        orderBy: { sortOrder: "asc" },
      },
      members: {
        include: {
          user: { select: { displayName: true, username: true } },
        },
      },
    },
  });

  if (!vault) notFound();

  const isOwner = vault.userId === user.id;

  // For owner: their other assets not already in this vault
  let availableAssets: { id: string; title: string }[] = [];
  if (isOwner) {
    const allMine = await prisma.asset.findMany({
      where: { userId: user.id },
      select: { id: true, title: true },
      take: 60,
    });
    const inVault = new Set(vault.assets.map((va) => va.assetId));
    availableAssets = allMine.filter((a) => !inVault.has(a.id));
  }

  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/vaults" className="text-sm text-[var(--text-muted)] hover:underline">← Vaults</Link>

      <div className="mt-4 flex items-start justify-between">
        <div>
          <h1 className="font-serif text-2xl font-semibold">{vault.name}</h1>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            {vault.vaultType} · {vault.visibility} {vault.owner && `· ${vault.owner.displayName || vault.owner.username}`}
          </p>
          {vault.description && <p className="mt-2 text-sm text-[var(--text-secondary)]">{vault.description}</p>}
        </div>
        {vault.priceApt != null && vault.priceApt > 0 && <span className="badge badge-paid">{formatApt(vault.priceApt)}</span>}
      </div>

      <section className="mt-8">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Assets in vault ({vault.assets.length})</h2>
          {isOwner && <span className="text-xs text-[var(--text-muted)]">Add from your assets below</span>}
        </div>

        {vault.assets.length === 0 ? (
          <p className="card mt-3 p-4 text-sm text-[var(--text-muted)]">This vault is empty.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {vault.assets.map(({ asset }) => (
              <li key={asset.id}>
                <Link href={`/assets/${asset.id}`} className="card block p-4 hover:border-[var(--border-accent)]">{asset.title}</Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {isOwner && (
        <VaultAssetAdder vaultId={id} availableAssets={availableAssets} />
      )}

      {isOwner && (
        <section className="mt-10">
          <h2 className="font-semibold">Members</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {vault.members.map((m) => (
              <li key={m.id} className="card p-3">{m.user.displayName || m.user.username} · {m.role}</li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-[var(--text-muted)]">Invite via future workspace or direct grant flows.</p>
        </section>
      )}
    </div>
  );
}
