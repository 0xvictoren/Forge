"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getShelbyPublicUrl } from "@/lib/shelby-public";
import { Heart, MessageCircle, Eye, Trash2, Edit2, Lock, X, List, ListX } from "lucide-react";
import { toast } from "sonner";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { useAptTransfer } from "@/lib/use-apt-transfer";
import { formatApt } from "@/lib/utils";
import { useAppStore } from "@/lib/store";
import { VideoPlayer } from "@shelby-protocol/player";
import { LEGACY_MARKETPLACE_PAYMENTS_ENABLED } from "@/lib/payment-policy";

interface StreamVideo {
  id: string;
  title: string;
  description?: string;
  blobRef: string;
  streamPriceApt: number;
  streamVisibility: string;
  viewCount: number;
  isListed?: boolean;
  createdAt: string;
  owner: {
    id: string;
    displayName?: string;
    username?: string;
    walletAddress?: string | null;
    address?: string | null;
  };
  isLiked?: boolean;
  likeCount?: number;
  commentCount?: number;
  isPaid?: boolean;
}

interface Comment {
  id: string;
  content: string;
  createdAt: string;
  user?: { id: string; displayName?: string; username?: string };
}

export default function StreamPage() {
  const [tab, setTab] = useState<"your" | "feed">("feed");
  const [videos, setVideos] = useState<StreamVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // Modal / player state (TikTok style single focus)
  const [selectedVideo, setSelectedVideo] = useState<StreamVideo | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");

  // Edit modal
  const [editingVideo, setEditingVideo] = useState<StreamVideo | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editVisibility, setEditVisibility] = useState<"everyone" | "subscribers" | "private">("everyone");
  const [editPrice, setEditPrice] = useState(0);
  const [editListed, setEditListed] = useState(false);

  const { connected, account } = useWallet();
  const { transfer } = useAptTransfer();
  const { user } = useAppStore();

  const fetchCurrentUser = async () => {
    try {
      const res = await fetch("/api/auth/me");
      const data = await res.json();
      setCurrentUserId(data.user?.id || null);
    } catch {
      setCurrentUserId(null);
    }
  };

  const fetchVideos = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/stream?tab=${tab}`);
      const data = await res.json();
      setVideos(data.videos || []);
    } catch (e) {
      toast.error("Failed to load streams");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCurrentUser();
    fetchVideos();
  }, [tab]);

  const isOwner = (video: StreamVideo) => {
    return currentUserId && video.owner.id === currentUserId;
  };

  const openVideo = async (video: StreamVideo) => {
    setSelectedVideo(video);
    // Increment view count server-side
    fetch(`/api/stream/${video.id}/view`, { method: "POST" }).catch(() => {});

    try {
      const res = await fetch(`/api/stream/${video.id}/comments`);
      const data = await res.json();
      setComments(data.comments || []);
    } catch {
      setComments([]);
    }
  };

  const closePlayer = () => {
    setSelectedVideo(null);
    setComments([]);
    setNewComment("");
  };

  const toggleLike = async (videoId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const res = await fetch(`/api/stream/${videoId}/like`, { method: "POST" });
    if (res.ok) {
      fetchVideos();
      // If open in player, we can optimistically update but refetch is fine
    }
  };

  const postComment = async () => {
    if (!selectedVideo || !newComment.trim()) return;
    const res = await fetch(`/api/stream/${selectedVideo.id}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: newComment.trim() }),
    });
    if (res.ok) {
      const data = await res.json();
      setComments((prev) => [...prev, data.comment]);
      setNewComment("");
      fetchVideos(); // refresh counts
    }
  };

  const payToWatch = async (video: StreamVideo) => {
    if (!LEGACY_MARKETPLACE_PAYMENTS_ENABLED) {
      toast.error("Paid streams are paused while Forge migrates settlement to USDC");
      return;
    }
    if (!connected || !account) {
      toast.error("Connect your wallet to unlock paid streams");
      return;
    }
    const recipient =
      video.owner.walletAddress ||
      video.owner.address ||
      (video.owner as any).username; // fallback rare

    if (!recipient || typeof recipient !== "string") {
      toast.error("Creator wallet not available for payment");
      return;
    }

    try {
      toast.loading("Sending payment...", { id: "pay" });
      const txHash = await transfer(recipient, video.streamPriceApt);
      const res = await fetch(`/api/stream/${video.id}/unlock`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ txHash }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Unlock failed");
      }
      toast.success("Payment confirmed. Video unlocked!", { id: "pay" });
      fetchVideos();
      // Re-open or refresh the player view
      if (selectedVideo?.id === video.id) {
        const refreshed = videos.find((v) => v.id === video.id);
        if (refreshed) setSelectedVideo({ ...refreshed, isPaid: true });
      }
    } catch (e: any) {
      toast.error(e.message || "Payment failed", { id: "pay" });
    }
  };

  const deleteVideo = async (video: StreamVideo, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!confirm("Delete this video? It will be permanently removed from Shelby storage.")) return;
    const res = await fetch(`/api/assets/${video.id}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("Video deleted from Shelby");
      fetchVideos();
      if (selectedVideo?.id === video.id) closePlayer();
      if (editingVideo?.id === video.id) setEditingVideo(null);
    } else {
      toast.error("Delete failed");
    }
  };

  // Edit / listing
  const startEdit = (video: StreamVideo, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setEditingVideo(video);
    setEditTitle(video.title || "");
    setEditDesc(video.description || "");
    setEditVisibility((video.streamVisibility as any) || "everyone");
    setEditPrice(video.streamPriceApt || 0);
    setEditListed(!!video.isListed);
  };

  const saveEdit = async () => {
    if (!editingVideo) return;
    try {
      const res = await fetch(`/api/assets/${editingVideo.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: editTitle.trim(),
          description: editDesc.trim(),
          streamVisibility: editVisibility,
          streamPriceApt: editPrice,
          isListed: editListed,
        }),
      });
      if (!res.ok) throw new Error("Update failed");
      toast.success("Stream updated");
      setEditingVideo(null);
      fetchVideos();
      if (selectedVideo?.id === editingVideo.id) {
        setSelectedVideo((prev) =>
          prev
            ? {
                ...prev,
                title: editTitle.trim(),
                description: editDesc.trim(),
                streamVisibility: editVisibility,
                streamPriceApt: editPrice,
                isListed: editListed,
              }
            : null
        );
      }
    } catch (e) {
      toast.error("Failed to save changes");
    }
  };

  const toggleListed = async (video: StreamVideo, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const newListed = !video.isListed;
    const res = await fetch(`/api/assets/${video.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isListed: newListed }),
    });
    if (res.ok) {
      toast.success(newListed ? "Listed to Explore" : "Delisted");
      fetchVideos();
    } else {
      toast.error("Failed to update listing");
    }
  };

  // Rich playable card (TikTok vertical style). Videos are playable inline.
  const renderVideoCard = (video: StreamVideo) => {
    const ownerMatch = isOwner(video);
    const locked = video.streamPriceApt > 0 && !video.isPaid && !ownerMatch;

    const src = getShelbyPublicUrl(video.blobRef);

    return (
      <div
        key={video.id}
        className="group relative mx-auto w-full max-w-[380px] overflow-hidden rounded-2xl bg-black shadow-2xl ring-1 ring-white/10"
        style={{ aspectRatio: "9 / 16" }}
      >
        <div className="relative h-full w-full bg-black" onClick={() => openVideo(video)}>
          {locked ? (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/90 p-6 text-center">
              <Lock className="mb-4 h-10 w-10 text-white/90" />
              <div className="text-xl font-semibold text-white">Locked</div>
              <p className="mt-1 text-sm text-white/80">
                Pay {formatApt(video.streamPriceApt)} APT to watch this video
              </p>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  payToWatch(video);
                }}
                className="mt-4 rounded-full bg-white px-6 py-2 text-sm font-semibold text-black active:scale-[0.985]"
              >
                Unlock with APT
              </button>
              <div className="mt-3 text-[10px] text-white/50">5% platform fee • instant access after payment</div>
            </div>
          ) : (
            // Native video for compact grid cards (lightweight). Full Media Kit player used in focused modal.
            <video
              className="h-full w-full object-cover"
              src={src}
              controls
              playsInline
              preload="metadata"
            />
          )}

          {/* Top right owner actions */}
          {ownerMatch && (
            <div className="absolute right-3 top-3 z-30 flex flex-col gap-2">
              <button
                onClick={(e) => deleteVideo(video, e)}
                className="rounded-full bg-black/70 p-2 text-white/90 backdrop-blur hover:bg-red-600/80"
                title="Delete from Shelby"
              >
                <Trash2 className="h-4 w-4" />
              </button>
              <button
                onClick={(e) => startEdit(video, e)}
                className="rounded-full bg-black/70 p-2 text-white/90 backdrop-blur hover:bg-white/20"
                title="Edit details & price"
              >
                <Edit2 className="h-4 w-4" />
              </button>
              <button
                onClick={(e) => toggleListed(video, e)}
                className="rounded-full bg-black/70 p-2 text-white/90 backdrop-blur hover:bg-white/20"
                title={video.isListed ? "Delist from Explore" : "List to Explore"}
              >
                {video.isListed ? <ListX className="h-4 w-4" /> : <List className="h-4 w-4" />}
              </button>
            </div>
          )}

          {/* TikTok-style right action rail */}
          <div className="absolute bottom-16 right-3 z-30 flex flex-col items-center gap-5 text-white">
            <button
              onClick={(e) => toggleLike(video.id, e)}
              className="flex flex-col items-center drop-shadow"
              aria-label="Like"
            >
              <Heart className={`h-8 w-8 transition ${video.isLiked ? "fill-red-500 text-red-500" : "text-white"}`} />
              <span className="mt-0.5 text-xs font-medium tabular-nums">{video.likeCount || 0}</span>
            </button>

            <button
              onClick={(e) => {
                e.stopPropagation();
                openVideo(video);
              }}
              className="flex flex-col items-center drop-shadow"
              aria-label="Comments"
            >
              <MessageCircle className="h-8 w-8" />
              <span className="mt-0.5 text-xs font-medium tabular-nums">{video.commentCount || 0}</span>
            </button>

            <div className="flex flex-col items-center text-white/90 drop-shadow">
              <Eye className="h-8 w-8" />
              <span className="mt-0.5 text-xs font-medium tabular-nums">{video.viewCount || 0}</span>
            </div>
          </div>

          {/* Bottom gradient info (always visible) */}
          <div className="absolute bottom-0 left-0 right-0 z-10 bg-gradient-to-t from-black/90 via-black/70 to-transparent p-4 text-white">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="font-semibold leading-tight line-clamp-2">{video.title}</div>
                {video.description && (
                  <div className="mt-1 line-clamp-2 text-sm text-white/80">{video.description}</div>
                )}
                <div className="mt-1 text-xs text-white/60">
                  @{video.owner.username || video.owner.displayName || "creator"}
                  {video.streamPriceApt > 0 && (
                    <span className="ml-2 rounded bg-white/20 px-1.5 py-px text-[10px]">PAID</span>
                  )}
                  {video.isListed && <span className="ml-1.5 rounded bg-emerald-500/70 px-1 py-px text-[10px]">LISTED</span>}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-[100dvh] bg-[#050505] pb-12 text-white">
      <div className="mx-auto max-w-3xl px-4 pt-8">
        {/* Header */}
        <div className="mb-6 text-center">
          <h1 className="font-serif text-3xl font-semibold tracking-tighter">Streams on Shelby</h1>
          <p className="mx-auto mt-2 max-w-md text-[15px] text-white/70">
            Your streamed videos will appear here.
          </p>
          
        </div>

        {/* Two toggles: Your videos / Feed */}
        <div className="mb-6 flex justify-center border-b border-white/10">
          <button
            onClick={() => setTab("your")}
            className={`px-8 py-3 text-sm font-semibold tracking-wide transition ${
              tab === "your" ? "border-b-2 border-white text-white" : "text-white/60 hover:text-white/80"
            }`}
          >
            Your Videos
          </button>
          <button
            onClick={() => setTab("feed")}
            className={`px-8 py-3 text-sm font-semibold tracking-wide transition ${
              tab === "feed" ? "border-b-2 border-white text-white" : "text-white/60 hover:text-white/80"
            }`}
          >
            Feed
          </button>
        </div>

        {loading ? (
          <div className="py-16 text-center text-white/60">Loading streams…</div>
        ) : videos.length === 0 ? (
          <div className="card mx-auto max-w-sm border-white/10 bg-white/5 p-10 text-center text-white">
            <p className="text-white/70">No videos yet in this view.</p>
            <Link href="/upload" className="btn-primary mt-4 inline-block">Upload a Stream video</Link>
          </div>
        ) : (
          <div className="space-y-10 pb-10">
            {videos.map((v) => renderVideoCard(v))}
          </div>
        )}

        <div className="mt-6 text-center">
          <Link href="/upload" className="text-sm text-white/60 underline hover:text-white">Upload another video →</Link>
        </div>
      </div>

      {/* Fullscreen-ish TikTok player + comments (rich playable experience inside platform) */}
      {selectedVideo && (
        <div className="fixed inset-0 z-[70] flex flex-col items-center justify-center bg-black/95 p-2 md:p-6" onClick={closePlayer}>
          <div
            className="relative flex h-[min(94dvh,780px)] w-full max-w-[420px] flex-col overflow-hidden rounded-3xl border border-white/10 bg-black shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Top bar */}
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-3 text-sm">
              <div className="flex items-center gap-2 text-white/70">
                <span>Streams on Shelby</span>
                {selectedVideo.streamPriceApt > 0 && <span className="rounded bg-white/10 px-2 py-0.5 text-[10px]">PAID</span>}
                <span className="ml-2 rounded bg-white/5 px-1.5 py-px text-[10px] text-white/50">Shelby Media Kit</span>
              </div>
              <button onClick={closePlayer} className="rounded p-1 text-white/70 hover:bg-white/10">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Rich playable video area - using official Shelby Media Kit VideoPlayer */}
            <div className="relative flex-1 bg-black">
              {selectedVideo.streamPriceApt > 0 && !selectedVideo.isPaid && !isOwner(selectedVideo) ? (
                <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/95 p-8 text-center">
                  <div>
                    <Lock className="mx-auto mb-4 h-12 w-12 text-white" />
                    <div className="text-2xl font-semibold">Locked video</div>
                    <p className="mt-2 text-white/75">Pay {formatApt(selectedVideo.streamPriceApt)} APT to watch</p>
                    <button onClick={() => payToWatch(selectedVideo)} className="mt-5 w-full rounded-full bg-white py-3 font-semibold text-black">
                      Pay &amp; Unlock
                    </button>
                    <p className="mt-3 text-xs text-white/50">5% platform fee goes to Forge • instant unlock</p>
                  </div>
                </div>
              ) : (
                <div className="h-full w-full">
                  <VideoPlayer
                    src={getShelbyPublicUrl(selectedVideo.blobRef)}
                    title={selectedVideo.title}
                    autoplay
                    // The player supports direct MP4 today and will support HLS manifests when we add @shelby-protocol/media-prepare preparation step
                  />
                </div>
              )}

              {/* Overlay side actions inside player (likes etc) */}
              <div className="absolute right-4 bottom-24 z-20 flex flex-col items-center gap-6 text-white">
                <button onClick={() => toggleLike(selectedVideo.id)} className="flex flex-col items-center">
                  <Heart className={`h-9 w-9 ${selectedVideo.isLiked ? "fill-red-500 text-red-500" : ""}`} />
                  <span className="mt-0.5 text-xs">{selectedVideo.likeCount || 0}</span>
                </button>
                <button onClick={() => { /* focus comment input */ }} className="flex flex-col items-center">
                  <MessageCircle className="h-9 w-9" />
                  <span className="mt-0.5 text-xs">{selectedVideo.commentCount || 0}</span>
                </button>
                <div className="flex flex-col items-center text-white/80">
                  <Eye className="h-9 w-9" />
                  <span className="mt-0.5 text-xs">{selectedVideo.viewCount}</span>
                </div>
                {isOwner(selectedVideo) && (
                  <>
                    <button onClick={() => deleteVideo(selectedVideo)} className="text-red-400"><Trash2 className="h-7 w-7" /></button>
                    <button onClick={() => startEdit(selectedVideo)}><Edit2 className="h-7 w-7" /></button>
                  </>
                )}
              </div>
            </div>

            {/* Info + comments */}
            <div className="border-t border-white/10 bg-[#0a0a0a] p-4 text-sm">
              <div className="mb-2 font-semibold">{selectedVideo.title}</div>
              {selectedVideo.description && <div className="mb-3 text-white/70">{selectedVideo.description}</div>}

              {/* Comment section (TikTok style) */}
              <div className="mb-2 text-xs uppercase tracking-[1px] text-white/50">Comments</div>
              <div className="max-h-[140px] space-y-2 overflow-auto pr-1 text-sm">
                {comments.length === 0 && <div className="text-white/50">Be the first to comment.</div>}
                {comments.map((c, idx) => (
                  <div key={idx} className="flex gap-2 text-white/90">
                    <span className="font-medium text-white/70">{c.user?.displayName || c.user?.username || "user"}:</span>
                    <span>{c.content}</span>
                  </div>
                ))}
              </div>

              <div className="mt-3 flex gap-2">
                <input
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && postComment()}
                  placeholder="Add a comment..."
                  className="input flex-1 border-white/20 bg-black text-white placeholder:text-white/40"
                />
                <button onClick={postComment} className="btn-primary px-5">Post</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit modal (title, desc, visibility, price, listing) */}
      {editingVideo && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/80 p-4" onClick={() => setEditingVideo(null)}>
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#111] p-5 text-white" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <div className="font-semibold">Edit stream details</div>
              <button onClick={() => setEditingVideo(null)}><X className="h-5 w-5" /></button>
            </div>

            <label className="text-xs text-white/60">Title</label>
            <input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} className="input mb-3 mt-1 w-full" />

            <label className="text-xs text-white/60">Description</label>
            <textarea value={editDesc} onChange={(e) => setEditDesc(e.target.value)} className="input mb-3 mt-1 w-full" rows={3} />

            <label className="text-xs text-white/60">Visibility</label>
            <select value={editVisibility} onChange={(e) => setEditVisibility(e.target.value as any)} className="input mb-3 mt-1 w-full">
              <option value="everyone">Everyone</option>
              <option value="subscribers">Subscribers only</option>
              <option value="private">Private</option>
            </select>

            <label className="text-xs text-white/60">Price (APT, 0 is free)</label>
            <input type="number" step="0.1" min={0} value={editPrice} onChange={(e) => setEditPrice(Math.max(0, Number(e.target.value)))} className="input mb-4 mt-1 w-full" />

            <label className="mb-2 flex items-center gap-2 text-sm">
              <input type="checkbox" checked={editListed} onChange={(e) => setEditListed(e.target.checked)} />
              List publicly in Explore (isListed)
            </label>

            <div className="flex gap-3">
              <button onClick={() => setEditingVideo(null)} className="flex-1 rounded-lg border border-white/20 py-2">Cancel</button>
              <button onClick={saveEdit} className="flex-1 btn-primary">Save changes</button>
            </div>
            <div className="mt-3 text-center text-[10px] text-white/40">Changes to price/visibility take effect immediately. Delete removes from Shelby blobs too.</div>
          </div>
        </div>
      )}
    </div>
  );
}
