"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { toast } from "sonner";

type Props = {
  url: string;
  label?: string;
  className?: string;
  compact?: boolean;
};

export function CopyLinkButton({ url, label = "Copy link", className = "", compact }: Props) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("Link copied");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Could not copy link");
    }
  };

  if (compact) {
    return (
      <button
        type="button"
        onClick={copy}
        className={`inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--accent)] hover:underline ${className}`}
      >
        {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
        {copied ? "Copied" : label}
      </button>
    );
  }

  return (
    <button type="button" onClick={copy} className={`btn-accent-ghost text-sm ${className}`}>
      {copied ? (
        <span className="inline-flex items-center gap-2">
          <Check className="h-4 w-4" /> Copied
        </span>
      ) : (
        <span className="inline-flex items-center gap-2">
          <Copy className="h-4 w-4" /> {label}
        </span>
      )}
    </button>
  );
}