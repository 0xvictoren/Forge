"use client";

import { Suspense } from "react";
import BurnLinkCreator from "@/components/burnlink/burn-link-creator";

export default function UploadPage() {
  return (
    <Suspense fallback={<p className="p-8 text-center text-[var(--text-muted)]">Loading…</p>}>
      <div className="py-8">
        <BurnLinkCreator />
      </div>
    </Suspense>
  );
}
