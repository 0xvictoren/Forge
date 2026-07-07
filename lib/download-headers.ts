const MIME_EXT: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/gif": ".gif",
  "image/webp": ".webp",
  "video/mp4": ".mp4",
  "video/webm": ".webm",
  "video/quicktime": ".mov",
  "audio/mpeg": ".mp3",
  "audio/wav": ".wav",
  "audio/ogg": ".ogg",
  "application/pdf": ".pdf",
  "application/zip": ".zip",
  "text/plain": ".txt",
  "text/html": ".html",
  "application/json": ".json",
};

const EXT_MIME: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
  mp4: "video/mp4",
  webm: "video/webm",
  mov: "video/quicktime",
  mp3: "audio/mpeg",
  wav: "audio/wav",
  ogg: "audio/ogg",
  pdf: "application/pdf",
  zip: "application/zip",
  txt: "text/plain",
  html: "text/html",
  json: "application/json",
  fig: "application/octet-stream",
  psd: "application/octet-stream",
};

export function mimeFromFileName(name: string): string {
  const ext = name.split(".").pop()?.toLowerCase();
  return (ext && EXT_MIME[ext]) || "application/octet-stream";
}

export function ensureFileExtension(name: string, mimeType?: string | null): string {
  const trimmed = name.trim() || "download";
  if (trimmed.includes(".")) return trimmed;
  if (mimeType && MIME_EXT[mimeType]) return `${trimmed}${MIME_EXT[mimeType]}`;
  return trimmed;
}

export function sanitizeDownloadFileName(name: string): string {
  return name.replace(/[^\w.\-() ]/g, "_").replace(/\s+/g, " ").trim() || "download";
}

export function buildContentDisposition(fileName: string, download: boolean): string {
  const safe = sanitizeDownloadFileName(fileName);
  const encoded = encodeURIComponent(safe);
  const mode = download ? "attachment" : "inline";
  return `${mode}; filename="${safe}"; filename*=UTF-8''${encoded}`;
}

export function buildDownloadResponseHeaders(
  fileName: string,
  mimeType: string,
  download: boolean
): Record<string, string> {
  return {
    "Content-Type": mimeType || mimeFromFileName(fileName),
    "Content-Disposition": buildContentDisposition(fileName, download),
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
  };
}