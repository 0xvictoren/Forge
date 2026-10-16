import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArrowUpRight, CheckCircle2, CircleDashed, HardDrive, XCircle } from "lucide-react";
import { AppFrame } from "@/components/shell/app-frame";
import { FileHasher } from "@/components/datasets/file-hasher";
import { Reveal } from "@/components/motion/reveal";
import { computeProof } from "@/lib/datasets/proof";
import { formatBytes } from "@/lib/datasets/modalities";
import { SOURCE_TYPE_LABELS } from "@/lib/datasets/manifest";
import { truncateAddress } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Proof of provenance" };

function Check({ ok, label, detail }: { ok: boolean | null; label: string; detail: string }) {
  return (
    <div className="flex items-start gap-3 py-3.5">
      {ok === null ? (
        <CircleDashed className="mt-0.5 h-5 w-5 shrink-0 text-[var(--text-muted)]" />
      ) : ok ? (
        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[var(--green)]" />
      ) : (
        <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-[var(--red)]" />
      )}
      <div>
        <p className="text-[15px] font-medium">{label}</p>
        <p className="text-[13px] text-[var(--text-secondary)]">{detail}</p>
      </div>
    </div>
  );
}

export default async function ProofPage({ params }: { params: Promise<{ versionId: string }> }) {
  const { versionId } = await params;
  if (!/^[0-9a-f]{24}$/i.test(versionId)) notFound();
  const proof = await computeProof(versionId);
  if (!proof) notFound();
  const { checks } = proof;

  return (
    <AppFrame>
      <Reveal className="text-center">
        <span
          className={`mx-auto flex h-16 w-16 items-center justify-center rounded-full ${proof.verified ? "bg-[var(--green-dim)] text-[var(--green)]" : "bg-[var(--red-dim)] text-[var(--red)]"}`}
        >
          {proof.verified ? <CheckCircle2 className="h-8 w-8" /> : <XCircle className="h-8 w-8" />}
        </span>
        <p className="eyebrow mt-6">Proof of provenance</p>
        <h1 className="display-lg mx-auto mt-2 max-w-[20ch]">{proof.verified ? "This dataset is exactly what was sealed." : "This seal does not verify."}</h1>
        <p className="lede mx-auto mt-3 max-w-xl">
          {proof.dataset.visibility === "listed" ? (
            <Link href={`/datasets/${proof.dataset.slug}`} className="text-[var(--accent-ink)] hover:underline">
              {proof.dataset.title}
            </Link>
          ) : (
            proof.dataset.title
          )}{" "}
          · version {proof.version.versionNumber} · {proof.version.fileCount.toLocaleString()} files · {formatBytes(proof.version.totalBytes)}
        </p>
      </Reveal>

      <div className="mt-12 grid gap-6 lg:grid-cols-2">
        <Reveal className="surface px-6 py-2">
          <Check ok={checks.manifestHash} label="Manifest hash recomputed" detail="Every file path, size and SHA-256, hashed again from the stored manifest." />
          <div className="h-px bg-[var(--border-dim)]" />
          <Check ok={checks.datasheetHash} label="Datasheet hash recomputed" detail="The seller's declarations about source, rights and consent." />
          <div className="h-px bg-[var(--border-dim)]" />
          <Check ok={checks.sealHash} label="Seal recomputed" detail="Binds dataset, version, manifest and datasheet into one digest." />
          <div className="h-px bg-[var(--border-dim)]" />
          <Check
            ok={checks.onChain}
            label={checks.onChain === null ? "Not anchored onchain" : "Onchain anchor matches"}
            detail={
              checks.onChain === null
                ? "The seller sealed this version offchain. Hashes still verify, but there's no public timestamp."
                : checks.onChain
                  ? `Signed by ${truncateAddress(proof.owner || "")} on Aptos${proof.version.anchoredAt ? ` · ${new Date(proof.version.anchoredAt).toLocaleString()}` : ""}.`
                  : checks.onChainError || "The onchain event does not match."
            }
          />
        </Reveal>
        <Reveal delay={0.08} className="surface p-6">
          <dl className="space-y-4">
            {[
              ["Seal hash", proof.sealHash],
              ["Manifest hash", proof.manifestHash],
              ["Datasheet hash", proof.datasheetHash],
              ["Sealed by", proof.owner],
            ].map(([k, v]) => (
              <div key={k}>
                <dt className="text-[13px] text-[var(--text-secondary)]">{k}</dt>
                <dd className="mono mt-1 break-all text-[13px]">{v || "None"}</dd>
              </div>
            ))}
          </dl>
          {proof.anchorExplorerUrl && (
            <a href={proof.anchorExplorerUrl} target="_blank" rel="noreferrer" className="btn-secondary btn-sm mt-6">
              View transaction on Aptos <ArrowUpRight className="h-3.5 w-3.5" />
            </a>
          )}
        </Reveal>
      </div>

      {proof.availability && (
        <Reveal className="mt-6 surface p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <span
                className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${
                  proof.availability.status === "available"
                    ? "bg-[var(--green-dim)] text-[var(--green)]"
                    : proof.availability.status === "unknown"
                      ? "bg-[var(--bg-hover)] text-[var(--text-muted)]"
                      : "bg-[var(--orange-dim)] text-[var(--orange)]"
                }`}
              >
                <HardDrive className="h-5 w-5" />
              </span>
              <div>
                <p className="text-[16px] font-semibold">
                  {proof.availability.status === "available"
                    ? "Stored and retrievable on Shelby"
                    : proof.availability.status === "unknown"
                      ? "Storage status unavailable right now"
                      : proof.availability.status === "degraded"
                        ? "Some files are not committed on Shelby"
                        : "Files are not committed on Shelby"}
                </p>
                <p className="text-[13px] text-[var(--text-secondary)]">
                  {proof.availability.committed} of {proof.availability.filesChecked} sampled files committed onchain
                  {proof.availability.providerAcks ? ` · ${proof.availability.providerAcks} storage provider acknowledgements` : ""}
                  {proof.availability.auditEpoch ? ` · audit epoch ${proof.availability.auditEpoch}` : ""}
                </p>
              </div>
            </div>
            <p className="caption shrink-0">Checked {new Date(proof.availability.checkedAt).toLocaleTimeString()}</p>
          </div>
        </Reveal>
      )}

      <Reveal className="mt-12">
        <h2 className="title-lg">Check your files</h2>
        <p className="mt-2 text-[15px] text-[var(--text-secondary)]">
          Drop files from this dataset to confirm they match the sealed manifest. Fingerprinted text deliveries intentionally differ;
          binary files match exactly.
        </p>
        <div className="mt-5">
          <FileHasher manifest={proof.manifest.files.map((f) => ({ path: f.path, sha256: f.sha256, sizeBytes: f.sizeBytes }))} />
        </div>
      </Reveal>

      <Reveal className="mt-12 surface p-6">
        <h2 className="title">Sealed declarations</h2>
        <dl className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-[13px] text-[var(--text-secondary)]">Source</dt>
            <dd className="mt-1 text-[15px]">{SOURCE_TYPE_LABELS[proof.datasheet.sourceType]}</dd>
          </div>
          <div>
            <dt className="text-[13px] text-[var(--text-secondary)]">Personal data</dt>
            <dd className="mt-1 text-[15px]">{proof.datasheet.containsPersonalData ? `Yes: ${proof.datasheet.consentBasis}` : "None declared"}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-[13px] text-[var(--text-secondary)]">Rights statement</dt>
            <dd className="mt-1 text-[15px]">{proof.datasheet.rightsStatement}</dd>
          </div>
        </dl>
      </Reveal>
    </AppFrame>
  );
}
