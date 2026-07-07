import { PageShell } from "@/components/layout/page-shell";
import { HireSearch } from "@/components/hire/hire-search";
import { HireDiscovery } from "@/components/hire/hire-discovery";

export default function HirePage() {
  return (
    <PageShell showSearch={false}>
      <section
        className="relative px-4 py-20 lg:px-8 lg:py-24"
        style={{
          backgroundColor: "#dc5429",
          backgroundImage: "url(/orange.webp)",
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        <div className="relative mx-auto max-w-3xl text-center text-white">
          <h1 className="text-3xl font-bold md:text-5xl">
            Discover creators on Forge
          </h1>
          <p className="mt-4 text-white/90">
            Find Web3-native talent with on-chain payments and Shelby-secured deliverables.
          </p>
          <HireSearch />
          <p className="mt-4 text-xs text-white/80">
            Pay in APT · 2% platform fee · Shelby storage included
          </p>
        </div>
      </section>

      <section className="bg-[var(--bg-surface)]">
        <div className="mx-auto max-w-[1200px] px-4 pt-10 lg:px-8">
          <h2 className="text-2xl font-bold">Discover creators</h2>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            Search by name, skill, or category — follow and hire directly on Forge.
          </p>
        </div>
        <HireDiscovery />
      </section>
    </PageShell>
  );
}
