"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { glassMode } from "./glass-filters";
import { useLensFilter } from "./use-lens-filter";

type LiquidGlassProps = {
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
  radius?: number;
  /** Bezel width in px. */
  depth?: number;
  /** Displacement strength in px. */
  scale?: number;
  curvature?: number;
  chroma?: number;
  /** Frost amount in px. */
  frost?: number;
  tone?: "auto" | "dark";
  strong?: boolean;
  as?: "div" | "nav" | "header" | "section" | "aside";
};

/**
 * A surface of liquid glass. Chromium refracts the backdrop through a
 * shape-generated displacement map; other engines get frosted glass with the
 * same specular sheen and rim light, so the material reads the same everywhere.
 */
export const LiquidGlass = forwardRef<HTMLDivElement, LiquidGlassProps>(function LiquidGlass(
  {
    children,
    className,
    style,
    radius = 28,
    depth = 14,
    scale = 26,
    curvature = 1.6,
    chroma = 0.18,
    frost = 10,
    tone = "auto",
    strong,
    as: Tag = "div",
  },
  forwardedRef
) {
  const ref = useRef<HTMLDivElement>(null);
  useImperativeHandle(forwardedRef, () => ref.current as HTMLDivElement);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const [refract, setRefract] = useState(false);

  useEffect(() => {
    setRefract(glassMode() === "refract");
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const box = entry.borderBoxSize?.[0];
      const w = box ? box.inlineSize : entry.contentRect.width;
      const h = box ? box.blockSize : entry.contentRect.height;
      setSize((prev) => (prev && Math.abs(prev.w - w) < 1 && Math.abs(prev.h - h) < 1 ? prev : { w, h }));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const { filterId, svg } = useLensFilter(
    refract && size ? { width: size.w, height: size.h, radius, depth, curvature, scale, chroma } : null
  );

  const backdrop = filterId
    ? `url(#${filterId}) blur(${Math.max(0, frost * 0.35)}px) saturate(175%)`
    : `blur(${frost * 2}px) saturate(185%)`;

  return (
    <Tag
      ref={ref as never}
      className={cn("glass", strong && "glass-strong", tone === "dark" && "glass-dark", className)}
      style={{
        borderRadius: radius,
        WebkitBackdropFilter: `blur(${frost * 2}px) saturate(185%)`,
        backdropFilter: backdrop,
        ...style,
      }}
    >
      {svg}
      {children}
    </Tag>
  );
});
