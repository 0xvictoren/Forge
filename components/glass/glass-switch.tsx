"use client";

import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";
import { useLensFilter } from "./use-lens-filter";

const W = 52;
const H = 32;
const THUMB_W = 30;
const THUMB_H = 26;
const PAD = 3;

/**
 * Switch with a glass thumb. The thumb refracts a copy of the track fill at
 * full strength, so it reads as a moving highlight (Aave's switch treatment).
 */
export function GlassSwitch({
  checked,
  onChange,
  label,
  disabled,
  className,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  disabled?: boolean;
  className?: string;
}) {
  const reduce = useReducedMotion();
  const { filterId, svg } = useLensFilter({
    width: THUMB_W,
    height: THUMB_H,
    radius: THUMB_H / 2,
    depth: 7,
    curvature: 1.8,
    scale: 12,
    chroma: 0.3,
  });
  const x = checked ? W - THUMB_W - PAD : PAD;
  const spring = reduce ? { duration: 0 } : { type: "spring" as const, stiffness: 600, damping: 34 };

  const track = (
    <span
      className="absolute inset-0 rounded-full transition-colors duration-300"
      style={{ background: checked ? "var(--green-solid)" : "var(--bg-inset)" }}
    />
  );

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn("relative isolate shrink-0 rounded-full outline-none disabled:opacity-40", className)}
      style={{ width: W, height: H }}
    >
      {svg}
      {track}
      <motion.span
        aria-hidden
        className="absolute overflow-hidden rounded-full"
        style={{
          top: PAD,
          left: 0,
          width: THUMB_W,
          height: THUMB_H,
          background: "rgba(255,255,255,0.92)",
          boxShadow: "0 3px 8px rgba(0,0,0,0.15), 0 1px 1px rgba(0,0,0,0.06), inset 0 1px 0 rgba(255,255,255,1)",
        }}
        initial={false}
        animate={{ x }}
        transition={spring}
      >
        <span className="absolute inset-0" style={{ filter: filterId ? `url(#${filterId})` : undefined, opacity: 0.55 }}>
          <motion.span
            className="absolute top-0 block"
            style={{ width: W, height: H, top: -PAD }}
            initial={false}
            animate={{ x: -x }}
            transition={spring}
          >
            {track}
          </motion.span>
        </span>
        <span
          className="absolute inset-0 rounded-full"
          style={{ background: "linear-gradient(180deg, rgba(255,255,255,0.7), rgba(255,255,255,0) 60%)" }}
        />
      </motion.span>
    </button>
  );
}
