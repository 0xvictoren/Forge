import Link from "next/link";
import { ForgeWordmark } from "./forge-mark";

const COLUMNS = [
  {
    title: "Marketplace",
    links: [
      { href: "/datasets", label: "Browse datasets" },
      { href: "/studio", label: "Sell a dataset" },
      { href: "/licenses", label: "Your licences" },
    ],
  },
  {
    title: "Trust",
    links: [
      { href: "/verify", label: "Verify a dataset" },
      { href: "/compliance", label: "Compliance records" },
      { href: "/#how", label: "How sealing works" },
    ],
  },
  {
    title: "Built on",
    links: [
      { href: "https://shelby.xyz", label: "Shelby storage" },
      { href: "https://aptosfoundation.org", label: "Aptos" },
      { href: "https://unsplash.com/?utm_source=forge&utm_medium=referral", label: "Photography: Unsplash" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-[var(--border-dim)] bg-[var(--bg-surface)]">
      <div className="mx-auto max-w-[1080px] px-5 py-14">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div className="max-w-xs">
            <ForgeWordmark />
            <p className="mt-4 text-[14px] leading-relaxed text-[var(--text-secondary)]">
              A marketplace for AI training data that can prove where it came from, and who it went to.
            </p>
          </div>
          {COLUMNS.map((col) => (
            <div key={col.title}>
              <h3 className="text-[12px] font-semibold text-[var(--text-primary)]">{col.title}</h3>
              <ul className="mt-3 space-y-2.5">
                {col.links.map((l) => (
                  <li key={l.href}>
                    <Link href={l.href} className="text-[14px] text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]">
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-12 flex flex-col gap-2 border-t border-[var(--border-dim)] pt-6 text-[12px] text-[var(--text-muted)] sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} Forge. Compliance records are drafts to support your obligations, not legal advice.</p>
          <p>Testnet: settlements use APT on ShelbyNet.</p>
        </div>
      </div>
    </footer>
  );
}
