"use client";

import { useState } from "react";
import { Copy, Check, MessageCircle, Link2 } from "lucide-react";
import Link from "next/link";

export function ShareBurnLink({
  slug,
  compact = false,
}: {
  slug: string;
  compact?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const shareUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/b/${slug}`
      : `/b/${slug}`;

  const copy = async () => {
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const dmHref = `/chat?new=1&message=${encodeURIComponent(`Unlock this file on Forge: ${shareUrl}`)}`;

  if (compact) {
    return (
      <button
        type="button"
        onClick={copy}
        className="inline-flex items-center gap-1 rounded-full border border-[var(--border-dim)] bg-[var(--bg-elevated)] px-3 py-1.5 text-xs font-semibold hover:bg-[var(--bg-hover)]"
        title="Copy share link"
      >
        {copied ? <Check className="h-3.5 w-3.5" /> : <Link2 className="h-3.5 w-3.5" />}
        {copied ? "Copied" : "Share"}
      </button>
    );
  }

  return (
    <div className="rounded-xl border border-[var(--border-dim)] bg-[var(--bg-subtle)] p-4">
      <p className="text-sm font-semibold">Shareable link</p>
      <p className="mt-1 text-xs text-[var(--text-secondary)]">
        Send to clients or DMs — no Forge account required to open.
      </p>
      <div className="mt-3 break-all rounded-lg bg-[var(--bg-elevated)] p-3 font-mono text-xs">
        {shareUrl}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" className="btn-primary flex-1 text-sm" onClick={copy}>
          {copied ? (
            <span className="inline-flex items-center gap-2">
              <Check className="h-4 w-4" /> Copied
            </span>
          ) : (
            <span className="inline-flex items-center gap-2">
              <Copy className="h-4 w-4" /> Copy link
            </span>
          )}
        </button>
        <Link href={dmHref} className="btn-ghost inline-flex flex-1 items-center justify-center gap-2 text-sm">
          <MessageCircle className="h-4 w-4" /> Send via DM
        </Link>
      </div>
    </div>
  );
}
