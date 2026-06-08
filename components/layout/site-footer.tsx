import Link from "next/link";
import { Globe } from "lucide-react";

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-[var(--border-dim)] bg-white py-4">
      <div className="mx-auto flex max-w-[1760px] flex-wrap items-center justify-between gap-4 px-4 text-sm text-[var(--text-secondary)] lg:px-8">
        <div className="flex items-center gap-2">
          <Globe className="h-4 w-4" />
          English
        </div>
        <nav className="flex flex-wrap gap-6">
          <Link
            href="https://github.com/0xvictoren/Forge"
            className="hover:text-[var(--text-primary)]"
          >
            Github
          </Link>
          <Link href="/privacy" className="hover:text-[var(--text-primary)]">
            Privacy
          </Link>
          <Link href="/help" className="hover:text-[var(--text-primary)]">
            Community
          </Link>
        </nav>
        <p className="text-xs text-[var(--text-muted)]">
          Aptos · Shelby storage
        </p>
      </div>
    </footer>
  );
}
