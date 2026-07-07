"use client";

import { Suspense, useState } from "react";
import { FileText, Link as LinkIcon, Package } from "lucide-react";
import AssetCreator from "@/components/v2/asset-creator";
import BurnLinkCreator from "@/components/burnlink/burn-link-creator";
import { BundleManager } from "@/components/v2/bundle-manager";

export default function UploadPage() {
  const [mode, setMode] = useState<"asset" | "burnlink" | "bundle">("asset");

  const options = [
    {
      key: "asset" as const,
      label: "Asset",
      icon: FileText,
      desc: "Upload files as discoverable assets for sale or sharing in the marketplace.",
    },
    {
      key: "burnlink" as const,
      label: "BurnLink",
      icon: LinkIcon,
      desc: "Create shareable, time or view limited gated links with optional payments.",
    },
    {
      key: "bundle" as const,
      label: "Bundle",
      icon: Package,
      desc: "Group existing or newly uploaded assets into a single pack for sale.",
    },
  ];

  return (
    <Suspense fallback={<p className="p-8 text-center text-[var(--text-muted)]">Loading…</p>}>
      <div className="mx-auto max-w-4xl px-4 py-8 lg:px-0">
        <div className="mb-8">
          <h2 className="font-display text-xl font-bold uppercase tracking-wide mb-4 text-center">
            Choose upload type
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {options.map((opt) => {
              const Icon = opt.icon;
              const isActive = mode === opt.key;
              return (
                <button
                  key={opt.key}
                  onClick={() => setMode(opt.key)}
                  className={`card p-6 text-left transition border-2 ${
                    isActive
                      ? "border-[var(--brand)] bg-[var(--accent-dim)]"
                      : "border-[var(--border-dim)] hover:border-[var(--brand)]"
                  }`}
                >
                  <div className="flex items-center gap-3 mb-3">
                    <Icon className="h-6 w-6 text-[var(--brand)]" />
                    <span className="font-semibold text-lg">{opt.label}</span>
                  </div>
                  <p className="text-sm text-[var(--text-secondary)]">{opt.desc}</p>
                </button>
              );
            })}
          </div>
        </div>

        {mode === "asset" && <AssetCreator />}
        {mode === "burnlink" && <BurnLinkCreator />}
        {mode === "bundle" && <BundleManager />}
      </div>
    </Suspense>
  );
}