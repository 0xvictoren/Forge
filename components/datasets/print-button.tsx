"use client";

import { Printer } from "lucide-react";

export function PrintButton({ label = "Print or save PDF" }: { label?: string }) {
  return (
    <button type="button" onClick={() => window.print()} className="btn-secondary btn-sm print:hidden">
      <Printer className="h-3.5 w-3.5" /> {label}
    </button>
  );
}
