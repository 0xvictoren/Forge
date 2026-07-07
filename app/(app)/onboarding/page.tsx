"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { X, ArrowRight, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { useAppStore } from "@/lib/store";
import { ProfileMediaPicker } from "@/components/profile/profile-media-picker";
import { resolveAvatarUrl, resolveBannerUrl } from "@/lib/profile-media";
import { getShelbyPublicUrl } from "@/lib/shelby-public";
import { useShelbyWalletUpload } from "@/hooks/use-shelby-wallet-upload";
import { formatShelbyUploadError } from "@/lib/shelby-upload-errors";

export default function ProfileSetupPage() {
  const router = useRouter();
  const { setUser } = useAppStore();
  const { uploadFile: shelbyUpload } = useShelbyWalletUpload();
  const [step, setStep] = useState(0);
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [avatarPreview, setAvatarPreview] = useState("");
  const [bannerPreview, setBannerPreview] = useState("");
  const [avatarRef, setAvatarRef] = useState("");
  const [bannerRef, setBannerRef] = useState("");
  const [avatarProgress, setAvatarProgress] = useState(0);
  const [bannerProgress, setBannerProgress] = useState(0);
  const [skillsInput, setSkillsInput] = useState("");
  const [socials, setSocials] = useState({
    twitter: "",
    instagram: "",
    behance: "",
    dribbble: "",
    artstation: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/auth/me");
        if (!res.ok || cancelled) return;
        const { user: u } = await res.json();
        if (!u || cancelled) return;
        if (u.username || u.handle) setUsername(u.username || u.handle || "");
        if (u.displayName) setDisplayName(u.displayName);
        if (u.bio) setBio(u.bio);
        if (u.avatarRef) setAvatarRef(u.avatarRef);
        if (u.bannerRef) setBannerRef(u.bannerRef);
        const av = resolveAvatarUrl(u);
        const bn = resolveBannerUrl(u);
        if (av) setAvatarPreview(av);
        if (bn) setBannerPreview(bn);
      } catch {
        /* ignore — user may be new */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const applyProfileMedia = async (ref: string, type: "avatar" | "banner") => {
    const setProgress = type === "avatar" ? setAvatarProgress : setBannerProgress;
    setProgress(60);
    const shelbyUrl = getShelbyPublicUrl(ref);

    const patchRes = await fetch("/api/users/me", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        type === "avatar" ? { avatarRef: ref } : { bannerRef: ref },
      ),
    });
    setProgress(90);
    if (!patchRes.ok) {
      const errBody = await patchRes.json().catch(() => ({}));
      throw new Error(errBody.error ?? "Failed to save profile image");
    }
    const { user: updated } = await patchRes.json();

    if (type === "avatar") {
      setAvatarRef(ref);
      setAvatarPreview(resolveAvatarUrl(updated) ?? shelbyUrl);
    } else {
      setBannerRef(ref);
      setBannerPreview(resolveBannerUrl(updated) ?? shelbyUrl);
    }
    setUser(updated);
    setProgress(100);
    toast.success(type === "avatar" ? "Avatar saved" : "Banner saved");
  };

  const uploadFile = async (file: File, type: "avatar" | "banner") => {
    const setProgress = type === "avatar" ? setAvatarProgress : setBannerProgress;
    setProgress(10);
    const preview = URL.createObjectURL(file);
    if (type === "avatar") setAvatarPreview(preview);
    else setBannerPreview(preview);

    try {
      setProgress(40);
      const uploaded = await shelbyUpload(file, type);
      setProgress(70);
      await applyProfileMedia(uploaded.blobRef, type);
    } catch (e) {
      setProgress(0);
      toast.error(
        e instanceof Error ? formatShelbyUploadError(e.message) : "Upload failed"
      );
    }
  };

  const selectShelbyRef = async (ref: string, type: "avatar" | "banner") => {
    const setProgress = type === "avatar" ? setAvatarProgress : setBannerProgress;
    setProgress(20);
    try {
      await applyProfileMedia(ref, type);
    } catch (e) {
      setProgress(0);
      toast.error(e instanceof Error ? e.message : "Failed to set image");
      throw e;
    }
  };

  const finish = async () => {
    setLoading(true);
    setError("");
    try {
      const skills = skillsInput
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          handle: username,
          displayName,
          bio,
          avatarRef: avatarRef,
          bannerRef: bannerRef,
          skills,
          socials: {
            x: socials.twitter || undefined,
            instagram: socials.instagram || undefined,
            behance: socials.behance || undefined,
            dribbble: socials.dribbble || undefined,
            artstation: socials.artstation || undefined,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");

      if (data.user) {
        setUser(data.user);
      } else {
        const meRes = await fetch("/api/auth/me");
        const meData = await meRes.json();
        if (meData.user) setUser(meData.user);
      }

      toast.success("Profile saved!");
      router.push("/profile");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-full flex-1 items-center justify-center overflow-y-auto bg-[var(--bg-base)] p-4">
      <div className="setup-modal relative max-w-xl">
        <button
          type="button"
          className="absolute right-4 top-4 rounded border border-[var(--border-dim)] p-1"
          onClick={() => router.push("/home")}
          aria-label="Skip setup"
        >
          <X className="h-4 w-4" />
        </button>
        <p className="mt-2 text-xs text-[var(--text-muted)]">
          Optional — skip anytime and upload files without a profile.
        </p>

        <p className="label-caps">Setup</p>
        <div className="flex items-start justify-between">
          <h1 className="font-display mt-1 text-3xl font-bold">
            {step === 0 ? "Create your profile" : "Skills & social links"}
          </h1>
          <span className="text-sm text-[var(--text-muted)]">Step {step + 1}/2</span>
        </div>

        {step === 0 && (
          <div className="mt-6 space-y-5">
            <div>
              <p className="label-caps mb-2">Avatar</p>
              <ProfileMediaPicker
                kind="avatar"
                previewUrl={avatarPreview}
                progress={avatarProgress}
                onLocalFile={(file) => uploadFile(file, "avatar")}
                onShelbySelect={(ref) => selectShelbyRef(ref, "avatar")}
              />
              <p className="mt-1 text-xs text-[var(--text-muted)]">
                Upload locally or pick from files already on Shelby
              </p>
            </div>

            <div>
              <p className="label-caps mb-2">Banner</p>
              <ProfileMediaPicker
                kind="banner"
                previewUrl={bannerPreview}
                progress={bannerProgress}
                onLocalFile={(file) => uploadFile(file, "banner")}
                onShelbySelect={(ref) => selectShelbyRef(ref, "banner")}
              />
            </div>

            <label className="block">
              <span className="label-caps">Handle *</span>
              <input
                className="input mt-1"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                pattern="[a-zA-Z0-9_]{3,24}"
              />
            </label>
            <label className="block">
              <span className="label-caps">Display name *</span>
              <input
                className="input mt-1"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
              />
            </label>
            <label className="block">
              <span className="label-caps">Bio</span>
              <textarea
                className="input mt-1 min-h-[80px]"
                maxLength={280}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
              />
            </label>
          </div>
        )}

        {step === 1 && (
          <div className="mt-6 space-y-4">
            <label className="block">
              <span className="label-caps">Skills (comma-separated)</span>
              <input
                className="input mt-1"
                placeholder="3D, Motion, Branding"
                value={skillsInput}
                onChange={(e) => setSkillsInput(e.target.value)}
              />
            </label>
            <p className="text-xs text-[var(--text-muted)]">
              Social links are optional and stored in your Forge account (not on Shelby).
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              {(
                [
                  ["twitter", "X / Twitter"],
                  ["instagram", "Instagram"],
                  ["behance", "Behance"],
                  ["dribbble", "Dribbble"],
                  ["artstation", "ArtStation"],
                ] as const
              ).map(([key, label]) => (
                <label key={key} className="block text-sm">
                  <span className="label-caps">{label}</span>
                  <input
                    className="input mt-1"
                    placeholder="https://"
                    value={socials[key]}
                    onChange={(e) =>
                      setSocials((s) => ({ ...s, [key]: e.target.value }))
                    }
                  />
                </label>
              ))}
            </div>
            <div className="rounded-lg bg-[var(--accent-dim)] px-4 py-3 text-sm text-[var(--brand)]">
              ✦ Unlock payments go directly to your wallet · 2% platform fee on sales
            </div>
          </div>
        )}

        {error && <p className="mt-4 text-sm text-[var(--red)]">{error}</p>}

        <div className="mt-8 flex justify-between">
          {step > 0 ? (
            <button type="button" className="btn-ghost" onClick={() => setStep(0)}>
              <ArrowLeft className="h-4 w-4" /> Back
            </button>
          ) : (
            <span />
          )}
          {step === 0 ? (
            <button
              type="button"
              className="btn-primary"
              disabled={!username}
              onClick={() => setStep(1)}
            >
              Next <ArrowRight className="h-4 w-4" />
            </button>
          ) : (
            <button type="button" className="btn-primary" disabled={loading} onClick={finish}>
              {loading ? "Saving…" : "Finish setup"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
