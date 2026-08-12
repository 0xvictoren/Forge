"use client";

import { Lock } from "lucide-react";

/**
 * Visual indicator that media is client-side encrypted (AES-256-GCM).
 */
export function EncryptedBadge({
  className = "",
  size = "md",
  label = "Encrypted",
}: {
  className?: string;
  size?: "sm" | "md";
  label?: string;
}) {
  const pad = size === "sm" ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-xs";
  const icon = size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5";

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border border-emerald-500/40 bg-emerald-500/10 font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-400 ${pad} ${className}`}
      title="AES-256-GCM client-side encryption — ciphertext only on Shelby"
    >
      <Lock className={icon} aria-hidden />
      {label}
    </span>
  );
}
