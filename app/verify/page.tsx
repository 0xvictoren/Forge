import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { Search } from "lucide-react";
import { prisma } from "@/lib/db";
import { AppFrame } from "@/components/shell/app-frame";
import { FileHasher } from "@/components/datasets/file-hasher";
import { Reveal } from "@/components/motion/reveal";

export const metadata: Metadata = { title: "Verify" };
export const dynamic = "force-dynamic";

export default async function VerifyPage({ searchParams }: { searchParams: Promise<{ seal?: string }> }) {
  const { seal } = await searchParams;
  let notFoundMsg: string | null = null;

  if (seal) {
    const clean = seal.trim().toLowerCase().replace(/^0x/, "");
    if (/^[0-9a-f]{64}$/.test(clean)) {
      const version = await prisma.datasetVersion.findFirst({ where: { sealHash: clean, status: "SEALED" }, select: { id: true } });
      if (version) redirect(`/proof/${version.id}`);
      notFoundMsg = "No sealed dataset matches that hash.";
    } else if (/^[0-9a-f]{24}$/.test(clean)) {
      redirect(`/proof/${clean}`);
    } else {
      notFoundMsg = "That doesn't look like a seal hash (64 hex characters).";
    }
  }

  return (
    <AppFrame>
      <Reveal className="mx-auto max-w-2xl text-center">
        <p className="eyebrow">Verify</p>
        <h1 className="display-lg mt-2">Don&apos;t trust. Verify.</h1>
        <p className="lede mt-3">Look up any seal, or fingerprint a file on your device. Verification never requires an account.</p>
      </Reveal>

      <Reveal delay={0.06} className="mx-auto mt-10 max-w-2xl">
        <form action="/verify" className="relative">
          <Search className="pointer-events-none absolute left-5 top-1/2 h-5 w-5 -translate-y-1/2 text-[var(--text-muted)]" />
          <input
            name="seal"
            defaultValue={seal}
            placeholder="Paste a seal hash"
            className="field mono h-14 rounded-full pl-13 pr-28 text-[14px]"
            style={{ paddingLeft: 52 }}
            aria-label="Seal hash"
          />
          <button type="submit" className="btn-primary btn-sm absolute right-2 top-1/2 -translate-y-1/2">
            Verify
          </button>
        </form>
        {notFoundMsg && <p className="mt-3 text-center text-[14px] text-[var(--red)]">{notFoundMsg}</p>}
      </Reveal>

      <Reveal delay={0.12} className="mx-auto mt-12 max-w-2xl">
        <FileHasher />
      </Reveal>
    </AppFrame>
  );
}
