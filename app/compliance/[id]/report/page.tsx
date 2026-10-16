import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { requirePageUser } from "@/lib/require-page-user";
import { buildProjectRecord } from "@/lib/datasets/compliance-server";
import { formatBytes, shortHash } from "@/lib/datasets/modalities";
import { ForgeWordmark } from "@/components/shell/forge-mark";
import { PrintButton } from "@/components/datasets/print-button";

export const metadata: Metadata = { title: "Training data record" };
export const dynamic = "force-dynamic";

function Section({ n, title, children }: { n: string; title: string; children: React.ReactNode }) {
  return (
    <section className="break-inside-avoid border-t border-[var(--border-dim)] py-8">
      <h2 className="text-[13px] font-semibold text-[var(--text-secondary)]">
        {n} · {title}
      </h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function KV({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="grid gap-1 py-2 sm:grid-cols-[220px_1fr]">
      <dt className="text-[14px] text-[var(--text-secondary)]">{k}</dt>
      <dd className="text-[15px]">{v || "None"}</dd>
    </div>
  );
}

export default async function ComplianceReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f]{24}$/i.test(id)) notFound();
  const user = await requirePageUser(`/compliance/${id}/report`);
  const h = await headers();
  const origin = `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host")}`;
  const built = await buildProjectRecord(id, user.id, origin);
  if (!built) notFound();
  const { record } = built;
  const g = record.general;

  return (
    <div className="min-h-screen bg-[var(--bg-base)] px-5 py-10 print:bg-white print:p-0">
      <div className="mx-auto max-w-[820px]">
        <div className="mb-6 flex items-center justify-between print:hidden">
          <Link href={`/compliance/${id}`} className="text-[14px] font-medium text-[var(--accent-ink)]">
            ‹ Back to record
          </Link>
          <PrintButton />
        </div>
        <article className="rounded-[32px] bg-[var(--bg-elevated)] p-8 shadow-[var(--shadow-md)] sm:p-12 print:rounded-none print:shadow-none">
          <header className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[13px] font-semibold text-[var(--accent-ink)]">Training data record</p>
              <h1 className="display-lg mt-2">{g.project}</h1>
              <p className="mt-2 text-[14px] text-[var(--text-secondary)]">Generated {new Date(record.generatedAt).toLocaleString(undefined, { dateStyle: "long", timeStyle: "short" })}</p>
            </div>
            <ForgeWordmark height={28} />
          </header>
          <p className="mt-6 rounded-2xl bg-[var(--orange-dim)] px-4 py-3 text-[13px] text-[var(--orange)]">{record.disclaimer}</p>

          <Section n="1" title="General information">
            <dl>
              <KV k="Model" v={g.model} />
              <KV k="Provider" v={g.provider} />
              <KV k="Intended purpose" v={g.intendedPurpose} />
              <KV k="Modalities" v={g.modalities.join(", ")} />
              <KV k="Languages" v={g.languages.join(", ")} />
              <KV k="Geographies" v={g.geographies.join(", ")} />
              <KV k="Collection period" v={g.collectionPeriod.start || g.collectionPeriod.end ? `${g.collectionPeriod.start ?? "?"} → ${g.collectionPeriod.end ?? "?"}` : null} />
              <KV k="Size" v={`${g.totals.datasets} datasets · ${g.totals.files.toLocaleString()} files · ${formatBytes(g.totals.bytes)}`} />
            </dl>
          </Section>

          <Section n="2" title="List of data sources">
            {Object.keys(record.dataSources).length === 0 ? (
              <p className="text-[14px] text-[var(--text-secondary)]">No sources added yet.</p>
            ) : (
              <div className="space-y-8">
                {Object.entries(record.dataSources).map(([section, items]) => (
                  <div key={section}>
                    <h3 className="title">{section}</h3>
                    <ul className="mt-3 space-y-3">
                      {items.map((s) => (
                        <li key={`${s.dataset}-${s.version}`} className="rounded-[20px] border border-[var(--border-dim)] p-4">
                          <div className="flex flex-wrap items-baseline justify-between gap-2">
                            <a href={s.url} className="text-[15px] font-semibold hover:text-[var(--accent-ink)]">
                              {s.dataset}
                            </a>
                            <span className="text-[12px] text-[var(--text-muted)]">v{s.version}</span>
                          </div>
                          {s.origin && <p className="mt-1 text-[13px] text-[var(--text-secondary)]">Origin: {s.origin}</p>}
                          {s.description && <p className="mt-2 text-[14px]">{s.description}</p>}
                          {s.rights && <p className="mt-1 text-[13px] text-[var(--text-secondary)]">Rights: {s.rights}</p>}
                          <div className="mono mt-3 grid gap-1 text-[11px] text-[var(--text-muted)]">
                            <span>seal {s.provenance.sealHash}</span>
                            {s.provenance.anchorTransaction ? <span>aptos tx {shortHash(s.provenance.anchorTransaction, 12)}</span> : <span>not anchored onchain</span>}
                            {s.license && (
                              <span>
                                licence {s.license.template.toLowerCase()} · {s.license.certificateUrl}
                              </span>
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </Section>

          <Section n="3" title="Data processing">
            <dl>
              <KV k="Personal data present" v={record.dataProcessing.personalDataPresent ? "Yes" : "No"} />
              <KV k="Consent / legal bases" v={record.dataProcessing.consentBases.join("; ")} />
              <KV k="TDM opt-outs respected" v={record.dataProcessing.textAndDataMiningOptOutsRespected ? "Yes, for all sources" : "Not confirmed for every source"} />
              <KV k="Processing steps" v={record.dataProcessing.processingSteps.length ? <ul className="list-disc pl-5">{record.dataProcessing.processingSteps.map((p) => <li key={p}>{p}</li>)}</ul> : null} />
              <KV k="Known limitations" v={record.dataProcessing.knownLimitations.length ? <ul className="list-disc pl-5">{record.dataProcessing.knownLimitations.map((p) => <li key={p}>{p}</li>)}</ul> : null} />
            </dl>
          </Section>
        </article>
      </div>
    </div>
  );
}
