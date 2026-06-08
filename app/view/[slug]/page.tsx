"use client";

import { useParams, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Download, Clock, Eye } from "lucide-react";

type BurnlinkAccess = {
  title?: string;
  description?: string;
  blobRefs?: string[];
  streamUrl?: string;
  mimeType?: string;
  remainingViews?: number | null;
  expiresAt?: string | null;
  expiresIn?: string | null;
  error?: string;
};

export default function BurnLinkViewer() {
  const params = useParams();
  const searchParams = useSearchParams();
  const slugParam = params.slug;
  const slug = Array.isArray(slugParam) ? slugParam[0] : slugParam;
  const token = searchParams.get("token");

  const [burnlink, setBurnlink] = useState<BurnlinkAccess | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug || !token) {
      setError("Invalid or missing access token");
      setLoading(false);
      return;
    }

    fetch(`/api/burnlinks/${slug}/access?token=${encodeURIComponent(token)}`)
      .then((r) => r.json())
      .then((data: BurnlinkAccess) => {
        if (data.error) {
          setError(data.error);
        } else {
          setBurnlink(data);
        }
        setLoading(false);
      })
      .catch(() => {
        setError("Failed to load file");
        setLoading(false);
      });
  }, [slug, token]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#d4d4d4]">
        <p className="text-lg">Loading from Shelby…</p>
      </div>
    );
  }

  if (error || !burnlink) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#d4d4d4] p-6">
        <div className="max-w-md rounded-3xl bg-white p-8 text-center">
          <p className="font-medium text-red-600">{error || "Access denied"}</p>
          <p className="mt-2 text-sm text-gray-500">
            This BurnLink may have expired or the link is invalid.
          </p>
        </div>
      </div>
    );
  }

  const mediaUrl =
    burnlink.streamUrl ||
    (burnlink.blobRefs?.[0]
      ? `/api/media/shelby?ref=${encodeURIComponent(burnlink.blobRefs[0])}`
      : "");
  const expiresLabel = burnlink.expiresAt
    ? new Date(burnlink.expiresAt).toLocaleString()
    : "No expiry";

  return (
    <div className="min-h-screen bg-[#d4d4d4] p-6">
      <div className="mx-auto max-w-2xl overflow-hidden rounded-3xl bg-white shadow-xl">
        <div className="border-b p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-orange-100 text-xl">
              📄
            </div>
            <div>
              <h1 className="text-xl font-semibold">{burnlink.title || "BurnLink file"}</h1>
              <p className="text-sm text-gray-500">Protected file on Shelby</p>
            </div>
          </div>
        </div>

        <div className="border-b bg-gray-50 p-6 text-sm">
          <div className="flex items-center justify-between">
            <p className="font-medium text-orange-600">
              Expires in {burnlink.expiresIn || "—"}
            </p>
            <div className="flex items-center gap-4 text-gray-500">
              <div className="flex items-center gap-1">
                <Eye size={16} />
                <span>{burnlink.remainingViews ?? "∞"} views left</span>
              </div>
              <div className="flex items-center gap-1">
                <Clock size={16} />
                <span>{expiresLabel}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="p-8">
          {mediaUrl ? (
            <div className="flex aspect-video items-center justify-center overflow-hidden rounded-2xl bg-black">
              {burnlink.mimeType?.startsWith("image") ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={mediaUrl}
                  alt={burnlink.title || "BurnLink file"}
                  className="max-h-[500px] w-auto object-contain"
                />
              ) : burnlink.mimeType?.startsWith("video") ? (
                <video src={mediaUrl} controls className="max-h-[500px] w-full" />
              ) : (
                <div className="py-12 text-center">
                  <p className="mb-4 text-gray-400">File ready for download</p>
                  <a
                    href={mediaUrl}
                    download
                    className="inline-flex items-center gap-2 rounded-2xl bg-black px-8 py-4 font-medium text-white"
                  >
                    <Download size={20} />
                    Download File
                  </a>
                </div>
              )}
            </div>
          ) : (
            <p className="py-12 text-center text-gray-400">No file attached</p>
          )}
        </div>

        <div className="flex gap-3 border-t bg-gray-50 p-6">
          {mediaUrl && (
            <a
              href={mediaUrl}
              download
              className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-black py-4 text-center font-semibold text-white"
            >
              <Download size={20} />
              Download
            </a>
          )}

          <button
            type="button"
            onClick={() => {
              navigator.clipboard.writeText(window.location.href);
              toast.success("Link copied!");
            }}
            className="flex-1 rounded-2xl border border-gray-300 py-4 font-medium"
          >
            📋 Share Link
          </button>
        </div>
      </div>
    </div>
  );
}
