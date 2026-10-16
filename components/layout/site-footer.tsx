import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="border-t border-[var(--border-dim)] bg-[var(--bg-surface)] py-4 text-sm text-[var(--text-secondary)] lg:py-6">
      <div className="mx-auto max-w-7xl px-6 lg:px-12">
        <div className="flex flex-col justify-between gap-y-6 md:flex-row md:items-center">
          <div>
            <div className="font-semibold text-[var(--text-primary)] tracking-tight">Forge</div>
            <p className="mt-1 text-xs">built by victoren</p>
          </div>

          <div className="flex flex-wrap gap-x-8 gap-y-2 text-sm">
            <Link href="/how-it-works" className="hover:text-[var(--text-primary)]">How it works</Link>
            <Link href="/faq" className="hover:text-[var(--text-primary)]">FAQ</Link>
            <Link href="https://github.com/0xvictoren/Forge" className="hover:text-[var(--text-primary)]" target="_blank">GitHub</Link>
            <a href="https://explorer.shelby.xyz/" target="_blank" rel="noreferrer" className="hover:text-[var(--text-primary)]">Explorer</a>
          </div>

          <div className="text-xs text-[var(--text-muted)] md:text-right">
            5% platform fee • Certificates of ownership • Shelby storage
          </div>
        </div>
      </div>
    </footer>
  );
}
