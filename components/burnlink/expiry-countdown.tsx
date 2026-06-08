"use client";

import { useEffect, useState } from "react";

function formatRemaining(ms: number): string {
  if (ms <= 0) return "Expired";
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m ${sec}s`;
  return `${m}m ${sec}s`;
}

export function ExpiryCountdown({ expiresAt }: { expiresAt: string | Date }) {
  const target = new Date(expiresAt).getTime();
  const [remaining, setRemaining] = useState(target - Date.now());

  useEffect(() => {
    const id = setInterval(() => setRemaining(target - Date.now()), 1000);
    return () => clearInterval(id);
  }, [target]);

  const expired = remaining <= 0;

  return (
    <p
      className={`text-sm font-medium ${expired ? "text-[var(--red)]" : "text-[var(--accent)]"}`}
    >
      {expired ? "This link has expired" : `Expires in ${formatRemaining(remaining)}`}
    </p>
  );
}
