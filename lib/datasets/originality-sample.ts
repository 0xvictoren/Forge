"use client";

import { TEXT_EXT, TEXT_SAMPLE_BYTES, type OriginalityFile } from "./originality-types";

/**
 * Builds what the originality check sees, on this device, before encryption:
 * text samples and 32x32 greyscale thumbnails. Never the full files.
 */

export function kindOf(file: File, path: string): OriginalityFile["kind"] {
  const t = file.type;
  if (t.startsWith("image/") && !/svg|heic|heif/.test(t)) return "image";
  if (t.startsWith("video/")) return "video";
  if (t.startsWith("text/") || /json|xml|csv|yaml|javascript/.test(t) || TEXT_EXT.test(path)) return "text";
  return "binary";
}

async function readText(file: File): Promise<string> {
  const dec = new TextDecoder("utf-8", { fatal: false });
  if (file.size <= TEXT_SAMPLE_BYTES * 3) return dec.decode(await file.arrayBuffer());
  // Start, middle and end, so copied passages anywhere in a big file show up.
  const parts: string[] = [];
  for (const at of [0, Math.floor(file.size / 2 - TEXT_SAMPLE_BYTES / 2), file.size - TEXT_SAMPLE_BYTES]) {
    const chunk = dec.decode(await file.slice(at, at + TEXT_SAMPLE_BYTES).arrayBuffer());
    parts.push(at === 0 ? chunk : chunk.slice(chunk.indexOf("\n") + 1));
  }
  return parts.join("\n");
}

function toGray(source: CanvasImageSource): number[] {
  const canvas = document.createElement("canvas");
  canvas.width = 32;
  canvas.height = 32;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(source, 0, 0, 32, 32);
  const { data } = ctx.getImageData(0, 0, 32, 32);
  const out = new Array<number>(1024);
  for (let i = 0; i < 1024; i++) out[i] = Math.round(0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2]);
  return out;
}

async function hasExif(file: File) {
  const head = new Uint8Array(await file.slice(0, 128 * 1024).arrayBuffer());
  const s = new TextDecoder("latin1").decode(head);
  // Camera originals carry an Exif block naming the device.
  return s.includes("Exif\0\0") && /(Make|Model|Apple|Canon|NIKON|SONY|samsung|Google|FUJIFILM|OLYMPUS|Panasonic|HUAWEI|Xiaomi)/.test(s);
}

async function imageSample(file: File) {
  const bmp = await createImageBitmap(file);
  try {
    return { gray32: toGray(bmp), width: bmp.width, height: bmp.height, hasCameraMetadata: await hasExif(file) };
  } finally {
    bmp.close();
  }
}

function videoFrames(file: File, count = 5): Promise<{ frames: number[][]; width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const v = document.createElement("video");
    v.muted = true;
    v.preload = "auto";
    v.src = url;
    const frames: number[][] = [];
    let i = 0;
    const done = (err?: unknown) => {
      clearTimeout(timer);
      URL.revokeObjectURL(url);
      if (err && !frames.length) reject(err);
      else resolve({ frames, width: v.videoWidth, height: v.videoHeight });
    };
    const timer = setTimeout(() => done(new Error("timeout")), 20_000);
    const next = () => {
      if (i >= count || !isFinite(v.duration)) return done();
      v.currentTime = Math.min(v.duration - 0.05, (v.duration * (i + 0.5)) / count);
      i++;
    };
    v.onloadedmetadata = next;
    v.onseeked = () => {
      try {
        frames.push(toGray(v));
      } catch (e) {
        return done(e);
      }
      next();
    };
    v.onerror = () => done(new Error("unreadable video"));
  });
}

/** Sample one file. Anything unreadable still counts, by its SHA-256 alone. */
export async function sampleFile(file: File, path: string, sha256: string): Promise<OriginalityFile> {
  const base = { sha256, path, sizeBytes: file.size, mime: file.type };
  const kind = kindOf(file, path);
  try {
    if (kind === "text") return { ...base, kind, text: await readText(file) };
    if (kind === "image") return { ...base, kind, ...(await imageSample(file)) };
    if (kind === "video") return { ...base, kind, ...(await videoFrames(file)) };
  } catch {
    // fall through to an exact-match-only entry
  }
  return { ...base, kind: "binary" };
}
