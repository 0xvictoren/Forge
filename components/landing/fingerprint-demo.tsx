"use client";

import { motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { Eye, Fingerprint } from "lucide-react";
import { GlassSwitch } from "@/components/glass/glass-switch";
import { decodeSignatures, fingerprintContent, parseDelimited, stripSignatures } from "@/lib/datasets/fingerprint";
import { cn } from "@/lib/utils";

const SOURCE = [
  "frame,scene,hand_x,hand_y,action",
  ...Array.from({ length: 23 }, (_, i) => {
    const actions = ["grasp knife", "slice onion", "move bowl", "pour oil", "stir pan", "open drawer"];
    return `${1000 + i * 12},kitchen_04,${(0.31 + ((i * 7) % 40) / 100).toFixed(3)},${(0.52 + ((i * 11) % 30) / 100).toFixed(3)},${actions[i % actions.length]}`;
  }),
].join("\n");

const LICENSES = [
  { id: "a", org: "Licensee A", seedHex: "5a".repeat(32), fingerprintId: "a1b2c3d4e5f60718", tone: "#FF8C1A" },
  { id: "b", org: "Licensee B", seedHex: "c3".repeat(32), fingerprintId: "0f1e2d3c4b5a6978", tone: "#bf5af2" },
];

type Copy = { rows: string[][]; canaryRows: Set<number> };

/** Runs the real fingerprinting code in the browser on a tiny sample. */
export function FingerprintDemo() {
  const [copies, setCopies] = useState<Copy[] | null>(null);
  const [reveal, setReveal] = useState(true);

  useEffect(() => {
    let cancelled = false;
    Promise.all(
      LICENSES.map(async (l) => {
        const out = await fingerprintContent(SOURCE, "csv", { seedHex: l.seedHex, fingerprintId: l.fingerprintId, fileId: "demo" });
        const rows = parseDelimited(out.text, ",");
        const canaryRows = new Set<number>();
        rows.forEach((r, i) => {
          if (decodeSignatures(r.join(",")).size) canaryRows.add(i);
        });
        return { rows, canaryRows };
      })
    ).then((c) => !cancelled && setCopies(c));
    return () => {
      cancelled = true;
    };
  }, []);

  const original = useMemo(() => new Set(SOURCE.split("\n")), []);

  return (
    <section className="relative overflow-hidden bg-[var(--bg-surface)] py-28">
      <div className="mx-auto max-w-[1080px] px-5">
        <div className="grid items-end gap-8 lg:grid-cols-[1fr_auto]">
          <div className="max-w-2xl">
            <p className="eyebrow">Anti-sharing, by design</p>
            <h2 className="display-xl mt-3">Every copy names its owner.</h2>
            <p className="lede mt-4">
              Two buyers, one dataset, two different files. Each copy carries canary rows and an invisible signature
              unique to its licence. If a copy leaks, the seller can trace it to the licence it came from in seconds.
            </p>
          </div>
          <label className="flex items-center gap-3 self-start rounded-full bg-[var(--bg-elevated)] py-2 pl-4 pr-2 shadow-[var(--shadow-sm)] lg:self-end">
            <Eye className="h-4 w-4 text-[var(--text-secondary)]" />
            <span className="text-[14px] font-medium">Reveal marks</span>
            <GlassSwitch checked={reveal} onChange={setReveal} label="Reveal fingerprint marks" />
          </label>
        </div>

        <div className="mt-12 grid gap-5 lg:grid-cols-2">
          {LICENSES.map((l, idx) => {
            const copy = copies?.[idx];
            return (
              <motion.div
                key={l.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.7, delay: idx * 0.1, ease: [0.22, 1, 0.36, 1] }}
                className="surface overflow-hidden"
              >
                <div className="flex items-center justify-between border-b border-[var(--border-dim)] px-5 py-3.5">
                  <div className="flex items-center gap-2">
                    <Fingerprint className="h-4 w-4" style={{ color: l.tone }} />
                    <span className="text-[14px] font-semibold">{l.org}</span>
                  </div>
                  <span className="mono text-[12px] text-[var(--text-muted)]">fp {l.fingerprintId.slice(0, 8)}</span>
                </div>
                <div className="max-h-[340px] overflow-auto no-scrollbar">
                  <table className="w-full text-left mono text-[12px]">
                    <tbody>
                      {(copy?.rows ?? parseDelimited(SOURCE, ",")).map((row, i) => {
                        const isCanary = !!copy?.canaryRows.has(i);
                        const isHeader = i === 0;
                        return (
                          <tr
                            key={i}
                            className={cn(
                              "border-b border-[var(--border-dim)] last:border-0 transition-colors duration-500",
                              isHeader && "bg-[var(--bg-subtle)] font-semibold text-[var(--text-secondary)]",
                              isCanary && reveal && "text-[var(--text-primary)]"
                            )}
                            style={isCanary && reveal ? { background: `${l.tone}1f` } : undefined}
                          >
                            {row.map((cell, j) => {
                              const clean = stripSignatures(cell);
                              return (
                                <td key={j} className="whitespace-nowrap px-3 py-1.5">
                                  {clean}
                                  {isCanary && reveal && cell !== clean && (
                                    <span className="ml-1 rounded px-1 text-[10px] font-semibold" style={{ background: l.tone, color: "#fff" }}>
                                      sig
                                    </span>
                                  )}
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="flex items-center justify-between border-t border-[var(--border-dim)] px-5 py-3 text-[12px] text-[var(--text-secondary)]">
                  <span>{copy ? `${copy.canaryRows.size} canary row${copy.canaryRows.size === 1 ? "" : "s"} added` : "Fingerprinting…"}</span>
                  <span>
                    {copy
                      ? `${copy.rows.filter((r, i) => i > 0 && !original.has(stripSignatures(r.join(",")))).length} unique to this licence`
                      : ""}
                  </span>
                </div>
              </motion.div>
            );
          })}
        </div>
        <p className="caption mt-5 text-center">
          This demo runs the same fingerprinting code Forge uses for deliveries, on a 23-row sample, in your browser.
        </p>
      </div>
    </section>
  );
}
