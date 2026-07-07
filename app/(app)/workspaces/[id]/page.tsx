import Link from "next/link";
import { notFound } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatApt } from "@/lib/utils";

export default async function WorkspaceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getSessionUser();
  if (!user) return null;

  const { id } = await params;

  const workspace = await prisma.workspace.findFirst({
    where: {
      id,
      OR: [
        { ownerId: user.id },
        { members: { some: { userId: user.id } } },
      ],
    },
    include: {
      members: {
        include: {
          user: { select: { displayName: true, username: true, avatarUrl: true } },
        },
      },
      owner: { select: { displayName: true, username: true } },
    },
  });

  if (!workspace) notFound();

  const invoices = await prisma.invoice.findMany({
    where: {
      OR: [{ issuerId: user.id }, { recipientId: user.id }],
    },
    orderBy: { createdAt: "desc" },
    take: 5,
  });

  return (
    <div>
      <Link href="/workspaces" className="text-sm text-[var(--text-muted)] hover:underline">
        ← Workspaces
      </Link>
      <h1 className="mt-4 font-serif text-2xl font-semibold">{workspace.name}</h1>
      {workspace.description && (
        <p className="mt-2 text-sm text-[var(--text-secondary)]">{workspace.description}</p>
      )}

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <section className="card p-6">
          <h2 className="font-semibold">Team</h2>
          <ul className="mt-4 space-y-2 text-sm">
            {workspace.members.map((m) => (
              <li key={m.id}>
                {m.user.displayName || m.user.username} · {m.role}
              </li>
            ))}
          </ul>
          <Link href="/chat" className="btn-accent-ghost mt-4 inline-flex text-sm">
            Open messages
          </Link>
        </section>

        <section className="card p-6">
          <h2 className="font-semibold">Invoices</h2>
          {invoices.length === 0 ? (
            <p className="mt-4 text-sm text-[var(--text-muted)]">No invoices yet.</p>
          ) : (
            <ul className="mt-4 space-y-2 text-sm">
              {invoices.map((inv) => (
                <li key={inv.id} className="flex justify-between">
                  <span>{inv.description}</span>
                  <span>
                    {formatApt(inv.amountApt)} · {inv.status}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <Link href="/wallet/invoices" className="btn-accent-ghost mt-4 inline-flex text-sm">
            Manage invoices
          </Link>
        </section>
      </div>
    </div>
  );
}
