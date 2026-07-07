"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { HardDrive, ImageIcon, Loader2, Upload } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type ShelbyLibraryImage = {
  blobRef: string;
  url: string;
  label: string;
  fileName?: string;
};

function ShelbyThumbnail({
  src,
  label,
  fill = false,
}: {
  src: string;
  label: string;
  fill?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const sizeClass = fill
    ? "absolute inset-0 h-full w-full"
    : "h-full w-full";

  useEffect(() => {
    setFailed(false);
  }, [src]);

  if (failed) {
    return (
      <div
        className={cn(
          "flex flex-col items-center justify-center gap-1 bg-[var(--bg-subtle)] p-2 text-center",
          sizeClass
        )}
      >
        <ImageIcon className="h-6 w-6 text-[var(--text-muted)]" />
        {label ? (
          <span className="line-clamp-2 text-[9px] text-[var(--text-muted)]">{label}</span>
        ) : null}
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      loading="lazy"
      decoding="async"
      className={cn(sizeClass, "object-cover")}
      onError={() => setFailed(true)}
    />
  );
}

type ProfileMediaPickerProps = {
  kind: "avatar" | "banner";
  previewUrl: string;
  progress?: number;
  disabled?: boolean;
  onLocalFile: (file: File) => void | Promise<void>;
  onShelbySelect: (blobRef: string) => void | Promise<void>;
};

export function ProfileMediaPicker({
  kind,
  previewUrl,
  progress = 0,
  disabled,
  onLocalFile,
  onShelbySelect,
}: ProfileMediaPickerProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [source, setSource] = useState<"local" | "shelby">("local");
  const [shelbyOpen, setShelbyOpen] = useState(false);
  const [shelbyImages, setShelbyImages] = useState<ShelbyLibraryImage[]>([]);
  const [shelbyLoading, setShelbyLoading] = useState(false);
  const [shelbyError, setShelbyError] = useState<string | null>(null);
  const [selectingRef, setSelectingRef] = useState<string | null>(null);

  const isUploading = progress > 0 && progress < 100;

  const loadShelbyLibrary = useCallback(async () => {
    setShelbyLoading(true);
    setShelbyError(null);
    try {
      const res = await fetch("/api/media/shelby-library");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load Shelby files");
      setShelbyImages(data.images ?? []);
    } catch (e) {
      setShelbyError(e instanceof Error ? e.message : "Failed to load files");
      setShelbyImages([]);
    } finally {
      setShelbyLoading(false);
    }
  }, []);

  useEffect(() => {
    if (shelbyOpen) loadShelbyLibrary();
  }, [shelbyOpen, loadShelbyLibrary]);

  const handleShelbyPick = async (blobRef: string) => {
    setSelectingRef(blobRef);
    try {
      await onShelbySelect(blobRef);
      setShelbyOpen(false);
    } finally {
      setSelectingRef(null);
    }
  };

  const previewClass =
    kind === "avatar"
      ? "relative h-20 w-20 shrink-0 overflow-hidden rounded-full bg-[var(--bg-subtle)]"
      : "relative mb-2 aspect-[4/1] overflow-hidden rounded-lg bg-[var(--bg-subtle)]";

  return (
    <div>
      <div className={kind === "avatar" ? "flex items-center gap-4" : ""}>
        <div className={previewClass}>
          {previewUrl ? <ShelbyThumbnail src={previewUrl} label="" fill /> : null}
          {isUploading && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/40">
              <Loader2 className="h-5 w-5 animate-spin text-white" />
            </div>
          )}
        </div>

        <div className={kind === "banner" ? "mt-3" : "min-w-0 flex-1"}>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={disabled || isUploading}
              onClick={() => {
                setSource("local");
                inputRef.current?.click();
              }}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition",
                source === "local"
                  ? "bg-[var(--charcoal)] text-[var(--text-cream)]"
                  : "border border-[var(--border-dim)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]",
                (disabled || isUploading) && "pointer-events-none opacity-50"
              )}
            >
              <Upload className="h-3.5 w-3.5" />
              Local file
            </button>
            <button
              type="button"
              disabled={disabled || isUploading}
              onClick={() => {
                setSource("shelby");
                setShelbyOpen(true);
              }}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition",
                source === "shelby"
                  ? "bg-[var(--charcoal)] text-[var(--text-cream)]"
                  : "border border-[var(--border-dim)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]",
                (disabled || isUploading) && "pointer-events-none opacity-50"
              )}
            >
              <HardDrive className="h-3.5 w-3.5" />
              From Shelby
            </button>
          </div>

          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            disabled={disabled || isUploading}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void onLocalFile(file);
              e.target.value = "";
            }}
          />

          {isUploading && (
            <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-[var(--bg-subtle)]">
              <div
                className="h-full bg-[var(--brand)] transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
          )}
        </div>
      </div>

      <Dialog open={shelbyOpen} onOpenChange={setShelbyOpen}>
        <DialogContent
          title={kind === "avatar" ? "Choose avatar from Shelby" : "Choose banner from Shelby"}
          className="max-w-2xl"
        >
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            Pick an image you have already uploaded to Shelby — assets, BurnLinks, or previous profile media.
          </p>

          {shelbyLoading ? (
            <div className="flex items-center justify-center gap-2 py-12 text-sm text-[var(--text-muted)]">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading your Shelby files…
            </div>
          ) : shelbyError ? (
            <p className="py-8 text-center text-sm text-[var(--red)]">{shelbyError}</p>
          ) : shelbyImages.length === 0 ? (
            <div className="py-8 text-center text-sm text-[var(--text-muted)]">
              <p>No images on Shelby yet.</p>
              <p className="mt-1">Upload from your device or publish assets first.</p>
            </div>
          ) : (
            <div className="mt-4 grid max-h-[55vh] grid-cols-2 gap-3 overflow-y-auto sm:grid-cols-3">
              {shelbyImages.map((img) => (
                <button
                  key={img.blobRef}
                  type="button"
                  disabled={!!selectingRef}
                  onClick={() => void handleShelbyPick(img.blobRef)}
                  className={cn(
                    "group flex flex-col overflow-hidden rounded-xl border border-[var(--border-dim)] bg-[var(--bg-elevated)] text-left shadow-sm transition hover:border-[var(--brand)] hover:shadow-md",
                    selectingRef === img.blobRef && "ring-2 ring-[var(--brand)]"
                  )}
                >
                  <div className="relative aspect-square w-full overflow-hidden bg-[var(--bg-subtle)]">
                    <ShelbyThumbnail src={img.url} label={img.label} />
                    {selectingRef === img.blobRef && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                        <Loader2 className="h-5 w-5 animate-spin text-white" />
                      </div>
                    )}
                  </div>
                  <div className="truncate px-2 py-1.5 text-[11px] font-medium text-[var(--text-secondary)]">
                    {img.label}
                  </div>
                </button>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}