"use client";

import { useEffect, useState } from "react";
import { FileText, Music, Film, Image as ImageIcon } from "lucide-react";

export type FileMeta = { name: string; size: number; mime: string };

function getIcon(mime: string) {
  if (mime.startsWith("video/")) return Film;
  if (mime.startsWith("audio/")) return Music;
  if (mime.startsWith("image/")) return ImageIcon;
  return FileText;
}

export function FilePreview({ files }: { files: FileMeta[] }) {
  const [previews, setPreviews] = useState<Record<number, string>>({});

  useEffect(() => {
    const urls: Record<number, string> = {};
    const revokes: string[] = [];

    files.forEach((f, i) => {
      if (f.mime.startsWith("image/") || f.mime.startsWith("video/") || f.mime.startsWith("audio/")) {
        const blob = new Blob([], { type: f.mime });
        // We don't have the actual File object here - previews are set by parent via blob URLs
      }
    });

    return () => revokes.forEach(URL.revokeObjectURL);
  }, [files]);

  if (files.length === 0) return null;

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {files.map((f, i) => {
        const Icon = getIcon(f.mime);
        const preview = previews[i];
        return (
          <div key={i} className="card overflow-hidden p-3">
            <div className="flex aspect-video items-center justify-center overflow-hidden rounded-xl bg-[var(--bg-subtle)]">
              {preview ? (
                f.mime.startsWith("video/") ? (
                  <video src={preview} className="h-full w-full object-contain" controls />
                ) : f.mime.startsWith("audio/") ? (
                  <audio src={preview} controls className="w-full px-4" />
                ) : (
                  <img src={preview} alt={f.name} className="h-full w-full object-contain" />
                )
              ) : (
                <Icon className="h-10 w-10 text-[var(--text-muted)]" />
              )}
            </div>
            <p className="mt-2 truncate text-sm font-medium">{f.name}</p>
            <p className="text-xs text-[var(--text-muted)]">
              {(f.size / 1024 / 1024).toFixed(2)} MB · {f.mime.split("/")[0]}
            </p>
          </div>
        );
      })}
    </div>
  );
}

/** Preview from actual File objects before upload */
export function LocalFilePreview({ files }: { files: File[] }) {
  const [urls, setUrls] = useState<string[]>([]);

  useEffect(() => {
    const created = files.map((f) => URL.createObjectURL(f));
    setUrls(created);
    return () => created.forEach(URL.revokeObjectURL);
  }, [files]);

  if (files.length === 0) return null;

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {files.map((f, i) => {
        const Icon = getIcon(f.type);
        const url = urls[i];
        return (
          <div key={i} className="card overflow-hidden p-3">
            <div className="flex aspect-video items-center justify-center overflow-hidden rounded-xl bg-[var(--bg-subtle)]">
              {url && f.type.startsWith("image/") ? (
                <img src={url} alt={f.name} className="h-full w-full object-contain" />
              ) : url && f.type.startsWith("video/") ? (
                <video src={url} className="h-full w-full object-contain" controls />
              ) : url && f.type.startsWith("audio/") ? (
                <audio src={url} controls className="w-full px-4" />
              ) : (
                <Icon className="h-10 w-10 text-[var(--text-muted)]" />
              )}
            </div>
            <p className="mt-2 truncate text-sm font-medium">{f.name}</p>
            <p className="text-xs text-[var(--text-muted)]">
              {(f.size / 1024 / 1024).toFixed(2)} MB
            </p>
          </div>
        );
      })}
    </div>
  );
}