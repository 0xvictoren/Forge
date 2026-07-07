"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  Compass,
  BookOpen,
  MessageSquare,
  Upload,
  Package,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useI18n } from "@/components/providers/i18n-provider";
import { HEADER_NAV, isNavActive } from "@/lib/nav-config";

const NAV_ICONS: Record<string, typeof Home> = {
  home: Home,
  upload: Upload,
  library: BookOpen,
  vaults: Package,
  messages: MessageSquare,
  explore: Compass,
};

const NAV_I18N: Record<string, string> = {
  home: "nav_home",
  upload: "nav_upload",
  library: "nav_library",
  vaults: "nav_vaults",
  messages: "nav_messages",
  explore: "nav_explore",
};

export function BottomNav() {
  const pathname = usePathname();
  const { t } = useI18n();

  return (
    <nav className="z-50 shrink-0 border-t border-[var(--border-dim)] bg-[var(--bg-elevated)] pb-safe lg:hidden">
      <div className="mx-auto flex max-w-[1760px] items-center justify-around h-16 px-1">
        {HEADER_NAV.map((item) => {
          const Icon = NAV_ICONS[item.key] ?? Home;
          const active = isNavActive(pathname, item);
          const label = t(NAV_I18N[item.key] || item.label) || item.label;
          return (
            <Link
              key={item.key}
              href={item.href}
              className={cn(
                "flex flex-col items-center justify-center gap-0.5 px-1.5 py-1 text-[10px] font-medium transition-colors min-w-[44px] min-h-[44px]",
                active
                  ? "text-[var(--brand)]"
                  : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              )}
            >
              <Icon className={cn("h-5 w-5", active && "text-[var(--brand)]")} />
              <span className="truncate max-w-[52px]">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}