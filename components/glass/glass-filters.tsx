"use client";

import { useEffect } from "react";
import { prefersReducedTransparency, supportsBackdropRefraction } from "@/lib/glass/displacement-map";

/**
 * Sets html[data-glass] once on mount:
 *  - "refract": Chromium - backdrop refraction via SVG filters
 *  - "frost":   Safari / Firefox - frosted glass; controls still refract their own content
 *  - "solid":   reduced transparency requested
 */
export function GlassFilters() {
  useEffect(() => {
    const root = document.documentElement;
    const mode = prefersReducedTransparency() ? "solid" : supportsBackdropRefraction() ? "refract" : "frost";
    root.dataset.glass = mode;
  }, []);
  return null;
}

export function glassMode(): "refract" | "frost" | "solid" {
  if (typeof document === "undefined") return "frost";
  return (document.documentElement.dataset.glass as "refract" | "frost" | "solid") || "frost";
}
