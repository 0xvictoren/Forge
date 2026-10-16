"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useLensFilter } from "./use-lens-filter";

export type SegmentOption<T extends string> = { value: T; label: ReactNode; icon?: ReactNode };

/**
 * Segmented control whose selection indicator is a moving glass lens.
 *
 * Following Aave's approach, the lens does not sample the page behind it. It
 * holds a *highlighted copy* of the labels (the refraction target), shifted so
 * it lines up with the real labels, and bends that copy with the lens filter.
 * Because only the element's own pixels move, this works in every engine and
 * the real labels stay selectable and clickable underneath.
 */
export function GlassSegmented<T extends string>({
  options,
  value,
  onChange,
  className,
  size = "md",
  ariaLabel,
}: {
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
  size?: "sm" | "md";
  ariaLabel?: string;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const reduce = useReducedMotion();
  const index = Math.max(0, options.findIndex((o) => o.value === value));
  const pad = 4;
  const height = size === "sm" ? 34 : 42;
  const segment = options.length ? (width - pad * 2) / options.length : 0;
  const lensH = height - pad * 2;

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(e.contentRect.width + 0));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const { filterId, svg } = useLensFilter(
    segment > 8 ? { width: segment, height: lensH, radius: lensH / 2, depth: Math.min(7, lensH / 3), curvature: 2.2, scale: 9, chroma: 0.15 } : null
  );

  const labels = (highlight: boolean) =>
    options.map((o) => (
      <span
        key={o.value}
        className={cn(
          "flex items-center justify-center gap-1.5 truncate font-medium",
          size === "sm" ? "text-[13px]" : "text-[14px]",
          highlight ? "text-[var(--text-primary)]" : "text-[var(--text-secondary)]"
        )}
        style={{ width: segment, height: lensH }}
      >
        {o.icon}
        {o.label}
      </span>
    ));

  return (
    <div
      ref={trackRef}
      role="tablist"
      aria-label={ariaLabel}
      className={cn("relative isolate inline-flex select-none rounded-full bg-[var(--bg-hover)]", className)}
      style={{ height, padding: pad }}
    >
      {svg}
      {/* Real, interactive labels */}
      <div className="relative z-0 flex">
        {options.map((o) => (
          <button
            key={o.value}
            role="tab"
            type="button"
            aria-selected={o.value === value}
            onClick={() => onChange(o.value)}
            className="flex items-center justify-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
            style={{ width: segment, height: lensH }}
          >
            <span className="sr-only">{typeof o.label === "string" ? o.label : o.value}</span>
          </button>
        ))}
        <div aria-hidden className="pointer-events-none absolute inset-0 flex">
          {labels(false)}
        </div>
      </div>

      {/* Glass lens with the refracted, highlighted copy */}
      {segment > 0 && (
        <motion.div
          aria-hidden
          className="pointer-events-none absolute z-10 overflow-hidden rounded-full"
          style={{
            top: pad,
            left: pad,
            width: segment,
            height: lensH,
            background: "var(--bg-elevated)",
            boxShadow: "0 3px 10px rgba(0,0,0,0.12), 0 0 0 0.5px var(--glass-edge), inset 0 1px 0 var(--glass-highlight)",
          }}
          initial={false}
          animate={{ x: index * segment }}
          transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 520, damping: 38, mass: 0.9 }}
        >
          {/* The filter sits on a lens-sized wrapper so the map lines up with the lens. */}
          <div className="absolute inset-0" style={{ filter: filterId ? `url(#${filterId})` : undefined }}>
            <motion.div
              className="absolute left-0 top-0 flex"
              initial={false}
              animate={{ x: -index * segment }}
              transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 520, damping: 38, mass: 0.9 }}
            >
              {labels(true)}
            </motion.div>
          </div>
          <span
            className="absolute inset-0 rounded-full"
            style={{ background: "linear-gradient(180deg, rgba(255,255,255,0.35), rgba(255,255,255,0) 55%)", mixBlendMode: "soft-light" }}
          />
        </motion.div>
      )}
    </div>
  );
}
