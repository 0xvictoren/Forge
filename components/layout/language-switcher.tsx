"use client";

import { useI18n } from "@/components/providers/i18n-provider";
import type { Locale } from "@/lib/i18n/translations";

export function LanguageSwitcher({ className = "" }: { className?: string }) {
  const { locale, setLocale, locales } = useI18n();

  return (
    <select
      className={`rounded-full border border-[var(--border-dim)] bg-[var(--bg-elevated)] px-2 py-1 text-xs font-medium ${className}`}
      value={locale}
      onChange={(e) => setLocale(e.target.value as Locale)}
      aria-label="Language"
    >
      {locales.map(({ code, label }) => (
        <option key={code} value={code}>
          {label}
        </option>
      ))}
    </select>
  );
}
