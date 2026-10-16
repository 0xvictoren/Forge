"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { renderDisplacementMap, type LensShape } from "@/lib/glass/displacement-map";

export type LensOptions = LensShape & {
  /** Displacement strength in px. */
  scale: number;
  /** 0 … 1 - chromatic fringe (per-channel scale spread). */
  chroma?: number;
  /** Post-refraction softening in px. */
  blur?: number;
};

/**
 * Returns a filter id plus the hidden <svg> that defines it. Safari caches
 * filter output by id, so the id changes whenever the map is regenerated.
 */
export function useLensFilter(options: LensOptions | null) {
  const base = useId().replace(/:/g, "");
  const [map, setMap] = useState<string | null>(null);
  const revision = useRef(0);
  const [id, setId] = useState(`lens-${base}-0`);

  const shapeKey = options
    ? `${Math.round(options.width)}:${Math.round(options.height)}:${options.radius}:${options.depth}:${options.curvature}`
    : "";

  useEffect(() => {
    if (!options || options.width < 4 || options.height < 4) return;
    const url = renderDisplacementMap(options);
    if (!url) return;
    revision.current += 1;
    setMap(url);
    setId(`lens-${base}-${revision.current}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shapeKey, base]);

  const svg = useMemo(() => {
    if (!options || !map) return null;
    const s = options.scale;
    const c = Math.max(0, Math.min(1, options.chroma ?? 0));
    const w = Math.round(options.width);
    const h = Math.round(options.height);
    const channel = (name: string, scale: number, matrix: string) => (
      <>
        <feDisplacementMap
          in="SourceGraphic"
          in2="map"
          scale={scale}
          xChannelSelector="R"
          yChannelSelector="G"
          result={`d-${name}`}
        />
        <feColorMatrix in={`d-${name}`} type="matrix" values={matrix} result={`c-${name}`} />
      </>
    );
    return (
      <svg aria-hidden width="0" height="0" style={{ position: "absolute", width: 0, height: 0, pointerEvents: "none" }}>
        <defs>
          <filter
            id={id}
            x="0"
            y="0"
            width={w}
            height={h}
            filterUnits="userSpaceOnUse"
            primitiveUnits="userSpaceOnUse"
            colorInterpolationFilters="sRGB"
          >
            <feImage href={map} x="0" y="0" width={w} height={h} preserveAspectRatio="none" result="map" />
            {c > 0 ? (
              <>
                {channel("r", s * (1 + c), "1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0")}
                {channel("g", s, "0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0")}
                {channel("b", s * (1 - c), "0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0")}
                <feBlend in="c-r" in2="c-g" mode="screen" result="rg" />
                <feBlend in="rg" in2="c-b" mode="screen" result="refracted" />
              </>
            ) : (
              <feDisplacementMap in="SourceGraphic" in2="map" scale={s} xChannelSelector="R" yChannelSelector="G" result="refracted" />
            )}
            {options.blur ? <feGaussianBlur in="refracted" stdDeviation={options.blur} /> : null}
          </filter>
        </defs>
      </svg>
    );
  }, [map, id, options]);

  return { filterId: map ? id : null, svg };
}
