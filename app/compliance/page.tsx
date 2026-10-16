import Link from "next/link";
import type { Metadata } from "next";
import { ArrowUpRight, ShieldCheck } from "lucide-react";
import { prisma } from "@/lib/db";
import { requirePageUser } from "@/lib/require-page-user";
import { AppFrame, EmptyState, PageHeader } from "@/components/shell/app-frame";
import { NewProjectButton } from "@/components/compliance/new-project-form";
import { Reveal } from "@/components/motion/reveal";

export const metadata: Metadata = { title: "Compliance" };
export const dynamic = "force-dynamic";

export default async function CompliancePage() {
  const user = await requirePageUser("/compliance");
  const projects = await prisma.complianceProject.findMany({ where: { ownerId: user.id }, orderBy: { updatedAt: "desc" } });

  return (
    <AppFrame>
      <PageHeader
        eyebrow="Compliance"
        title="Training-data records"
        description="Document the data behind each model. Every source links to a seal on Aptos and, where licensed, a certificate."
        actions={<NewProjectButton />}
      />
      {projects.length === 0 ? (
        <EmptyState
          icon={<ShieldCheck className="h-6 w-6" />}
          title="Start your first record"
          description="Add datasets you've licensed on Forge or sealed from your own data, then export a structured record."
          action={<NewProjectButton />}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {projects.map((p, i) => (
            <Reveal key={p.id} delay={Math.min(i, 6) * 0.04} y={12}>
              <Link href={`/compliance/${p.id}`} className="surface surface-interactive flex h-full flex-col p-6">
                <div className="flex items-start justify-between">
                  <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--accent-dim)] text-[var(--accent-ink)]">
                    <ShieldCheck className="h-5 w-5" />
                  </span>
                  <ArrowUpRight className="h-4 w-4 text-[var(--text-muted)]" />
                </div>
                <h2 className="title mt-5">{p.name}</h2>
                {p.modelName && <p className="mono mt-1 text-[13px] text-[var(--text-secondary)]">{p.modelName}</p>}
                <p className="mt-auto pt-5 text-[13px] text-[var(--text-secondary)]">
                  {p.licenseIds.length + p.datasetVersionIds.length} sources · updated {p.updatedAt.toLocaleDateString()}
                </p>
              </Link>
            </Reveal>
          ))}
        </div>
      )}
      <p className="caption mt-10 text-center">Records are structured after the EU AI Office public summary template. They are a drafting aid, not legal advice.</p>
    </AppFrame>
  );
}
