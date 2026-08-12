"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronRight } from "lucide-react";
import { formatApt } from "@/lib/utils";
import { CopyLinkButton } from "@/components/ui/copy-link-button";
import { EncryptedDownloadButton } from "@/components/media/encrypted-download-button";
import { EncryptedBadge } from "@/components/ui/encrypted-badge";

type LibraryData = {
  purchases: Array<{
    id: string;
    title?: string;
    amountApt: number;
    createdAt: string;
    asset?: {
      id: string;
      title: string;
      priceApt: number;
      blobRef?: string | null;
      fileName?: string | null;
      isEncrypted?: boolean;
    } | null;
    product?: { id: string; title: string; productType: string } | null;
    certificate?: { verificationSlug: string; certificateId: string } | null;
  }>;
  ownedAssets?: Array<{
    id: string;
    title: string;
    priceApt: number;
    blobRef?: string | null;
    fileName?: string | null;
    isListed: boolean;
    createdAt: string;
    isPurchased?: boolean;
    isEncrypted?: boolean;
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
  activities?: Array<{
    id: string;
    type: string;
    title: string;
    amountApt?: number | null;
    assetId?: string | null;
    productId?: string | null;
    createdAt: string;
  }>;
};

function bundleShareUrl(id: string) {
  if (typeof window !== "undefined") return `${window.location.origin}/products/${id}`;
  return `/products/${id}`;
}

function downloadUrl(asset: { blobRef?: string | null; fileName?: string | null; title: string }) {
  if (!asset.blobRef) return null;
  return `/api/media/shelby?ref=${encodeURIComponent(asset.blobRef)}&download=1&filename=${encodeURIComponent(asset.fileName || asset.title || "asset")}`;
}

const TABS = ["Assets", "Bundles", "Subscriptions", "Certificates", "History"] as const;

const ACTIVITY_LABELS: Record<string, string> = {
  UPLOAD: "Uploaded",
  PURCHASE: "Purchased",
  DOWNLOAD: "Downloaded",
  DELETE: "Deleted",
};

function BundleCard({
  bundle,
  shareUrl,
  purchased,
  amountApt,
  certificateSlug,
}: {
  bundle: { id: string; title: string; priceApt: number; isListed?: boolean; items: Array<{ asset: { id: string; title: string } | null }> };
  shareUrl: string;
  purchased?: boolean;
  amountApt?: number;
  certificateSlug?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <li className="card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex min-w-0 flex-1 items-start gap-2 text-left"
        >
          {open ? (
            <ChevronDown className="mt-0.5 h-4 w-4 shrink-0 text-[var(--text-muted)]" />
          ) : (
            <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-[var(--text-muted)]" />
          )}
          <div className="min-w-0">
            <p className="font-semibold">{bundle.title}</p>
            <p className="text-xs text-[var(--text-muted)]">
              {bundle.items.length} assets
              {purchased && amountApt != null ? ` · ${formatApt(amountApt)} APT` : ` · ${formatApt(bundle.priceApt)} APT`}
              {!purchased && bundle.isListed != null && ` · ${bundle.isListed ? "Listed on Explore" : "Not listed"}`}
            </p>
          </div>
        </button>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {!purchased && <CopyLinkButton url={shareUrl} />}
          <Link href={`/products/${bundle.id}`} className="btn-accent-ghost text-sm">
            Open
          </Link>
          {certificateSlug && (
            <Link href={`/cert/${certificateSlug}`} className="text-xs text-[var(--accent)]">
              Cert
            </Link>
          )}
        </div>
      </div>
      {open && bundle.items.length > 0 && (
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
}

export function LibraryTabs({ data }: { data: LibraryData }) {
  const [tab, setTab] = useState<(typeof TABS)[number]>("Assets");

  const ownedOnly = data.ownedAssets || [];
  const ownedIds = new Set(ownedOnly.map((a) => a.id));
  const purchasedAssets = data.purchases.filter((p) => p.asset && !ownedIds.has(p.asset!.id));

  return (
    <div>
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
          {ownedOnly.length === 0 && purchasedAssets.length === 0 && data.grants.length === 0 && (
            <p className="text-[var(--text-secondary)]">No assets yet. Upload from the Upload page.</p>
          )}

          {ownedOnly.length > 0 && (
            <li className="mb-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">Your uploads</p>
            </li>
          )}
          {ownedOnly.map((a) => {
            const dl = downloadUrl(a);
            return (
              <li key={`owned-${a.id}`} className="card flex items-center justify-between gap-4 p-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{a.title}</p>
                    {a.isEncrypted && <EncryptedBadge size="sm" />}
                  </div>
                  <p className="text-xs text-[var(--text-muted)]">
                    {formatApt(a.priceApt)} APT · uploaded {new Date(a.createdAt).toLocaleDateString()}
                    {a.isListed ? " · Listed" : ""}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Link href={`/assets/${a.id}`} className="btn-accent-ghost text-sm">Open</Link>
                  {(dl || a.isEncrypted) && (
                    <EncryptedDownloadButton
                      downloadUrl={dl}
                      fileName={a.fileName || a.title}
                      isEncrypted={!!a.isEncrypted}
                      keyPackageUrl={`/api/assets/${a.id}/decrypt-package`}
                      asOwner
                      className="btn-primary text-sm px-4 py-2 inline-flex items-center gap-1.5"
                    />
                  )}
                </div>
              </li>
            );
          })}

          {purchasedAssets.length > 0 && ownedOnly.length > 0 && (
            <li className="mb-2 mt-6">
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">Purchased</p>
            </li>
          )}
          {purchasedAssets.map((p) => {
            const a = p.asset!;
            const dl = downloadUrl(a);
            return (
              <li key={p.id} className="card flex items-center justify-between gap-4 p-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{a.title}</p>
                    {a.isEncrypted && <EncryptedBadge size="sm" />}
                  </div>
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
                  {(dl || a.isEncrypted) && (
                    <EncryptedDownloadButton
                      downloadUrl={dl}
                      fileName={a.fileName || a.title}
                      isEncrypted={!!a.isEncrypted}
                      keyPackageUrl={`/api/assets/${a.id}/decrypt-package`}
                      className="btn-primary text-sm px-4 py-2 inline-flex items-center gap-1.5"
                    />
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
                {data.ownedBundles!.map((bundle) => (
                  <BundleCard
                    key={bundle.id}
                    bundle={bundle}
                    shareUrl={bundleShareUrl(bundle.id)}
                  />
                ))}
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
                    const items = (prod as { items?: Array<{ asset: { id: string; title: string } | null }> }).items || [];
                    return (
                      <BundleCard
                        key={p.id}
                        bundle={{
                          id: prod.id,
                          title: prod.title,
                          priceApt: p.amountApt,
                          items,
                        }}
                        shareUrl={bundleShareUrl(prod.id)}
                        purchased
                        amountApt={p.amountApt}
                        certificateSlug={p.certificate?.verificationSlug}
                      />
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
          {(data.activities?.length ?? 0) > 0 ? (
            data.activities!.map((a) => (
              <div
                key={a.id}
                className={`card flex items-center justify-between gap-4 p-3 ${
                  a.type === "DELETE" ? "border-l-4 border-[var(--red)]" : ""
                } ${a.type === "UPLOAD" ? "border-l-4 border-[var(--accent)]" : ""}`}
              >
                <div className="min-w-0">
                  <span className="font-medium">{ACTIVITY_LABELS[a.type] || a.type}</span>{" "}
                  <span className="truncate">{a.title}</span>
                </div>
                <div className="shrink-0 text-right text-[var(--text-muted)]">
                  {a.amountApt != null && a.amountApt > 0 ? `${formatApt(a.amountApt)} APT · ` : ""}
                  {new Date(a.createdAt).toLocaleDateString()}
                </div>
              </div>
            ))
          ) : (
            <>
              {data.purchases.map((p) => (
                <div key={`buy-${p.id}`} className="card p-3 flex justify-between">
                  <div>
                    <span className="font-medium">Purchased</span> {p.asset?.title || p.product?.title || "item"}
                  </div>
                  <div className="text-right text-[var(--text-muted)]">{formatApt(p.amountApt)} APT · {new Date(p.createdAt).toLocaleDateString()}</div>
                </div>
              ))}
              {(data.ownedAssets || []).map((a) => (
                <div key={`up-${a.id}`} className="card p-3 flex justify-between border-l-4 border-[var(--accent)]">
                  <div><span className="font-medium">Uploaded</span> {a.title}</div>
                  <div className="text-[var(--text-muted)]">{new Date(a.createdAt).toLocaleDateString()}</div>
                </div>
              ))}
              {(!data.purchases.length && !(data.ownedAssets?.length)) && (
                <p className="text-[var(--text-secondary)]">Your activity (uploads, purchases, downloads, deletions) will appear here.</p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}