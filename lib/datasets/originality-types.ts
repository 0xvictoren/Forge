/** Shared by the browser sampler, the seller CLI and the API. */

export type OriginalityFile = {
  sha256: string;
  path: string;
  sizeBytes: number;
  mime: string;
  kind: "text" | "image" | "video" | "binary";
  text?: string;
  gray32?: number[];
  frames?: number[][];
  width?: number;
  height?: number;
  hasCameraMetadata?: boolean;
};

export const TEXT_EXT = /\.(txt|md|markdown|rst|json|jsonl|ndjson|csv|tsv|xml|html?|ya?ml|srt|vtt|tex|log|py|js|ts|tsx|jsx|java|go|rs|c|cc|cpp|h|rb|php|swift|kt|sql|sh)$/i;
export const TEXT_SAMPLE_BYTES = 180_000;
/** Stay under Vercel's 4.5 MB request body limit with room to spare. */
const BATCH_BUDGET = 3_000_000;
const BATCH_FILES = 300;

export type OriginalityReport = {
  engine: string;
  score: number;
  passed: boolean;
  threshold: number;
  components: { uniqueness: number; internal: number; value: number; documentation: number };
  webChecked: boolean;
  tips: string[];
  findings: { path: string; message: string }[];
  matches: { datasetId: string; share: number; title?: string; slug?: string }[];
  checkedShas: string[];
  fileCount: number;
};

/** Several batch reports folded into one for the seller. */
export function combineReports(reports: OriginalityReport[]): OriginalityReport {
  if (reports.length === 1) return reports[0];
  const total = reports.reduce((s, r) => s + r.fileCount, 0) || 1;
  const avg = (pick: (r: OriginalityReport) => number) => Math.round((reports.reduce((s, r) => s + pick(r) * r.fileCount, 0) / total) * 10) / 10;
  return {
    engine: reports[0].engine,
    score: Math.min(avg((r) => r.score), ...reports.filter((r) => !r.passed).map((r) => r.score)),
    passed: reports.every((r) => r.passed),
    threshold: reports[0].threshold,
    components: {
      uniqueness: avg((r) => r.components.uniqueness),
      internal: avg((r) => r.components.internal),
      value: avg((r) => r.components.value),
      documentation: avg((r) => r.components.documentation),
    },
    webChecked: reports.every((r) => r.webChecked),
    tips: [...new Set(reports.flatMap((r) => r.tips))].slice(0, 5),
    findings: reports.flatMap((r) => r.findings).slice(0, 50),
    matches: reports.flatMap((r) => r.matches).sort((a, b) => b.share - a.share).slice(0, 5),
    checkedShas: reports.flatMap((r) => r.checkedShas),
    fileCount: total,
  };
}

/** Split samples into request-sized batches. */
export function batchSamples(samples: OriginalityFile[]): OriginalityFile[][] {
  const out: OriginalityFile[][] = [];
  let cur: OriginalityFile[] = [];
  let bytes = 0;
  for (const s of samples) {
    const size = (s.text?.length ?? 0) * 1.1 + (s.gray32 ? 4_500 : 0) + (s.frames?.length ?? 0) * 4_500 + 300;
    if (cur.length && (bytes + size > BATCH_BUDGET || cur.length >= BATCH_FILES)) {
      out.push(cur);
      cur = [];
      bytes = 0;
    }
    cur.push(s);
    bytes += size;
  }
  if (cur.length) out.push(cur);
  return out;
}
