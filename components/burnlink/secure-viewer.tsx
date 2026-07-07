"use client";

import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";

export function SecureViewerInner() {
  const params = useParams();
  const searchParams = useSearchParams();
  const slug = params.slug as string;
  const token = searchParams.get("token");
  const [blurred, setBlurred] = useState(false);
  const [meta, setMeta] = useState<{
    streamUrl?: string;
    fileName?: string;
    mimeType?: string;
  } | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const onBlur = () => setBlurred(true);
    const onFocus = () => setBlurred(false);
    window.addEventListener("blur", onBlur);
    window.addEventListener("focus", onFocus);
    const onCtx = (e: MouseEvent) => e.preventDefault();
    document.addEventListener("contextmenu", onCtx);
    return () => {
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("contextmenu", onCtx);
    };
  }, []);

  useEffect(() => {
    if (!token) {
      setError("Missing access token");
      return;
    }
    fetch(`/api/view/${slug}?token=${token}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) setError(d.error);
        else setMeta(d);
      });
  }, [slug, token]);

  return (
    <div className="relative min-h-screen bg-[var(--bg-base)] p-4">
      {blurred && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xl">
          <p className="text-[var(--text-primary)]">Content hidden — return to tab</p>
        </div>
      )}
      <div className="mx-auto max-w-4xl">
        <h1 className="font-display text-xl">Secure Viewer</h1>
        <p className="text-sm text-[var(--text-muted)]">{meta?.fileName || slug}</p>
        {error && <p className="mt-4 text-[var(--red)]">{error}</p>}
        {meta?.streamUrl && (
          <>
            <a
              href={`${meta.streamUrl}${meta.streamUrl.includes("?") ? "&" : "?"}download=1${meta.fileName ? `&filename=${encodeURIComponent(meta.fileName)}` : ""}`}
              className="btn-primary mt-4 inline-flex text-sm"
              download={meta.fileName || "download"}
            >
              Download {meta.fileName || "file"}
            </a>
            <div className="card mt-4 overflow-hidden">
              {meta.mimeType?.startsWith("image/") ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={meta.streamUrl} alt="" className="w-full" />
              ) : meta.mimeType?.startsWith("video/") ? (
                <video src={meta.streamUrl} controls className="w-full" />
              ) : (
                <iframe src={meta.streamUrl} className="min-h-[70vh] w-full" title="content" />
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
