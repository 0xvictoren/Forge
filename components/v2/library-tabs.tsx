"use client";

import { useState } from "react";
import Link from "next/link";
import { formatApt } from "@/lib/utils";
import { CopyLinkButton } from "@/components/ui/copy-link-button";

type LibraryData = {
  purchases: Array<{
    id: string;
    title?: string;
    amountApt: number;
    createdAt: string;
    asset?: { id: string; title: string; priceApt: number; blobRef?: string | null; fileName?: string | null } | null;
    product?: { id: string; title: string; productType: string } | null;
    certificate?: { verificationSlug: string; certificateId: string } | null;
  }>;
  certificates: Array<{
    id: string;
    certificateId: string;
    title: string;
    verificationSlug: string;
    issuedAt: string;
    txHash: string;
    seller?: { displayName?: string | null; username?: string | null };
  }>;
  subscriptions: Array<{
    id: string;
    status: string;
    renewsAt: string;
    tier?: {
      name: string;
      priceApt: number;
      creator?: { user?: { displayName?: string | null; username?: string | null } };
    };
  }>;
  grants: Array<{
    id: string;
    viewToken?: string | null;
    burnLink: {
      slug: string;
      title?: string | null;
      priceApt: number;
      file: { fileName: string };
      owner: { displayName?: string | null; username?: string | null };
    };
  }>;
  sales?: Array<{ id: string; title?: string; amount: number; buyer?: any; createdAt: string }>;
  invoices?: Array<{ id: string; description: string; amountApt: number; status: string; createdAt: string }>;
  transactions?: Array<{ id: string; type: string; description: string; direction: string; amount: number; createdAt: string }>;
  ownedBundles?: Array<{
    id: string;
    title: string;
    priceApt: number;
    isListed: boolean;
    createdAt: string;
    items: Array<{
      asset: { id: string; title: string; blobRef?: string | null; fileName?: string | null } | null;
    }>;
  }>;
};

function bundleShareUrl(id: string) {
  if (typeof window !== "undefined") return `${window.location.origin}/products/${id}`;
  return `/products/${id}`;
}

const TABS = ["Assets", "Bundles", "Subscriptions", "Certificates", "History"] as const;

export function LibraryTabs({ data }: { data: LibraryData }) {
  const [tab, setTab] = useState<(typeof TABS)[number]>("Assets");

  return (
    <div>
      {/* Mobile-friendly scrollable tabs */}
      <div className="mb-6 flex gap-2 border-b border-[var(--border-dim)] pb-2 overflow-x-auto snap-x lg:flex-wrap lg:overflow-visible">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`rounded-full px-4 py-1.5 text-sm font-semibold whitespace-nowrap snap-start ${
              tab === t
                ? "bg-[var(--accent-dim)] text-[var(--accent)]"
                : "text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "Assets" && (
        <ul className="space-y-3">
          {data.purchases.filter((p) => p.asset).length === 0 &&
            data.grants.length === 0 && (
              <p className="text-[var(--text-secondary)]">No assets yet.</p>
            )}
          {data.purchases
            .filter((p) => p.asset)
            .map((p) => {
              const a = p.asset!;
              const dl = a.blobRef
                ? `/api/media/shelby?ref=${encodeURIComponent(a.blobRef)}&download=1&filename=${encodeURIComponent(a.fileName || a.title || "asset")}`
                : null;
              return (
                <li key={p.id} className="card flex items-center justify-between gap-4 p-4">
                  <div className="min-w-0">
                    <p className="font-medium">{a.title}</p>
                    <p className="text-xs text-[var(--text-muted)]">
                      {formatApt(p.amountApt)} APT · purchased {new Date(p.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Link href={`/assets/${a.id}`} className="btn-accent-ghost text-sm">Open</Link>
                    {p.certificate?.verificationSlug && (
                      <Link href={`/cert/${p.certificate.verificationSlug}`} className="btn-accent-ghost text-sm">
                        Certificate
                      </Link>
                    )}
                    {dl && (
                      <a href={dl} download className="btn-primary text-sm px-4 py-2">Download</a>
                    )}
                  </div>
                </li>
              );
            })}
          {data.grants.map((g) => (
            <li key={g.id} className="card flex items-center justify-between p-4">
              <div>
                <p className="font-medium">
                  {g.burnLink.title || g.burnLink.file.fileName}
                </p>
                <p className="text-xs text-[var(--text-muted)]">BurnLink unlock</p>
              </div>
              {g.viewToken && (
                <Link
                  href={`/view/${g.burnLink.slug}?token=${g.viewToken}`}
                  className="btn-accent-ghost text-sm"
                >
                  Open
                </Link>
              )}
            </li>
          ))}
        </ul>
      )}

      {tab === "Bundles" && (
        <div className="space-y-8">
          {(data.ownedBundles?.length ?? 0) > 0 && (
            <section>
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                Your bundles
              </h3>
              <ul className="space-y-4">
                {data.ownedBundles!.map((bundle) => {
                  const shareUrl = bundleShareUrl(bundle.id);
                  return (
                    <li key={bundle.id} className="card p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-semibold">{bundle.title}</p>
                          <p className="text-xs text-[var(--text-muted)]">
                            {bundle.items.length} assets · {formatApt(bundle.priceApt)} APT ·{" "}
                            {bundle.isListed ? "Listed on Explore" : "Not listed"}
                          </p>
                          <p className="mt-2 break-all font-mono text-[11px] text-[var(--text-secondary)]">
                            {shareUrl}
                          </p>
                        </div>
                        <div className="flex shrink-0 flex-wrap items-center gap-2">
                          <CopyLinkButton url={shareUrl} />
                          <Link href={`/products/${bundle.id}`} className="btn-accent-ghost text-sm">
                            Open
                          </Link>
                        </div>
                      </div>
                      {bundle.items.length > 0 && (
                        <ul className="mt-3 space-y-1 border-t border-[var(--border-dim)] pt-3 text-sm">
                          {bundle.items.map((it, idx) => {
                            const a = it.asset;
                            if (!a) return null;
                            return (
                              <li key={idx} className="flex items-center justify-between py-1">
                                <span className="truncate pr-2">{a.title}</span>
                                <Link href={`/assets/${a.id}`} className="text-xs btn-accent-ghost px-3 py-0.5">
                                  Open
                                </Link>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          <section>
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[var(--text-muted)]">
              Purchased bundles
            </h3>
            <ul className="space-y-4">
              {data.purchases.filter((p) => p.product?.productType === "BUNDLE").length === 0 ? (
                <p className="text-[var(--text-secondary)]">
                  No purchased bundles yet. Create your own from Upload, or buy packs on Explore.
                </p>
              ) : (
                data.purchases
                  .filter((p) => p.product?.productType === "BUNDLE")
                  .map((p) => {
                    const prod = p.product!;
                    const items = (prod as { items?: unknown[] }).items || [];
                    return (
                      <li key={p.id} className="card p-4">
                        <div className="flex justify-between">
                          <div>
                            <p className="font-semibold">{prod.title}</p>
                            <p className="text-xs text-[var(--text-muted)]">
                              {items.length} assets · {formatApt(p.amountApt)} APT
                            </p>
                          </div>
                          {p.certificate?.verificationSlug && (
                            <Link href={`/cert/${p.certificate.verificationSlug}`} className="text-xs text-[var(--accent)]">
                              Cert
                            </Link>
                          )}
                        </div>
                      </li>
                    );
                  })
              )}
            </ul>
          </section>
        </div>
      )}

      {tab === "Subscriptions" && (
        <ul className="space-y-3">
          {data.subscriptions.length === 0 ? (
            <p className="text-[var(--text-secondary)]">No active subscriptions.</p>
          ) : (
            data.subscriptions.map((s) => (
              <li key={s.id} className="card p-4">
                <p className="font-medium">{s.tier?.name}</p>
                <p className="text-xs text-[var(--text-muted)]">
                  {s.tier?.creator?.user?.displayName || s.tier?.creator?.user?.username} ·{" "}
                  {s.status} · renews {new Date(s.renewsAt).toLocaleDateString()}
                </p>
              </li>
            ))
          )}
        </ul>
      )}

      {tab === "Certificates" && (
        <ul className="space-y-3">
          {data.certificates.length === 0 ? (
            <p className="text-[var(--text-secondary)]">No certificates yet.</p>
          ) : (
            data.certificates.map((c) => (
              <li key={c.id} className="card flex items-center justify-between p-4">
                <div>
                  <p className="font-medium">{c.title}</p>
                  <p className="font-mono text-xs text-[var(--text-muted)]">{c.certificateId}</p>
                </div>
                <div className="flex gap-2">
                  <Link href={`/cert/${c.verificationSlug}`} className="btn-accent-ghost text-sm">Verify</Link>
                  <a href={`/api/certificates/${c.verificationSlug}/pdf`} target="_blank" className="btn-accent-ghost text-sm">PDF</a>
                </div>
              </li>
            ))
          )}
        </ul>
      )}

      {tab === "History" && (
        <div className="space-y-2 text-sm">
          {/* Purchases (buyer) */}
          {data.purchases.map((p) => (
            <div key={`buy-${p.id}`} className="card p-3 flex justify-between">
              <div>
                <span className="font-medium">Purchased</span> {p.asset?.title || p.product?.title || "item"}
              </div>
              <div className="text-right text-[var(--text-muted)]">{formatApt(p.amountApt)} APT · {new Date(p.createdAt).toLocaleDateString()}</div>
            </div>
          ))}

          {/* Sales (as creator) */}
          {(data.sales || []).map((s: any) => (
            <div key={`sale-${s.id}`} className="card p-3 flex justify-between border-l-4 border-[var(--green)]">
              <div><span className="font-medium">Sold</span> {s.title} → {s.buyer?.displayName || s.buyer?.username || "buyer"}</div>
              <div className="text-[var(--text-muted)]">+{formatApt(s.amount)} APT</div>
            </div>
          ))}

          {/* Subscriptions */}
          {data.subscriptions.map((s) => (
            <div key={`sub-${s.id}`} className="card p-3 flex justify-between">
              <div>Subscribed to <span className="font-medium">{s.tier?.name}</span></div>
              <div className="text-[var(--text-muted)]">renews {new Date(s.renewsAt).toLocaleDateString()}</div>
            </div>
          ))}

          {/* Invoices */}
          {(data.invoices || []).map((inv: any) => (
            <div key={`inv-${inv.id}`} className="card p-3 flex justify-between">
              <div>Invoice: {inv.description}</div>
              <div className="text-[var(--text-muted)]">{formatApt(inv.amountApt)} · {inv.status}</div>
            </div>
          ))}

          {/* On-chain txs */}
          {(data.transactions || []).slice(0, 8).map((t: any) => (
            <div key={`tx-${t.id}`} className="card p-2 text-xs flex justify-between text-[var(--text-muted)]">
              <div>{t.type || t.direction} {t.description}</div>
              <div>{t.direction === "IN" ? "+" : ""}{formatApt(t.amount)} APT</div>
            </div>
          ))}

          {(!data.purchases.length && !(data.sales?.length) && !data.subscriptions.length) && (
            <p className="text-[var(--text-secondary)]">Your full activity (purchases, sales, subs, invoices, on-chain txs) will appear here.</p>
          )}
        </div>
      )}
    </div>
  );
}
