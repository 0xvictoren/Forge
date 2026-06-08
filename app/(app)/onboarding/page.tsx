"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { X, ArrowRight, ArrowLeft } from "lucide-react";

export default function ProfileSetupPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [avatarPreview, setAvatarPreview] = useState("");
  const [bannerPreview, setBannerPreview] = useState("");
  const [avatarCid, setAvatarCid] = useState("");
  const [bannerCid, setBannerCid] = useState("");
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

  const uploadFile = async (file: File, type: "avatar" | "banner") => {
    const setProgress = type === "avatar" ? setAvatarProgress : setBannerProgress;
    setProgress(10);
    const preview = URL.createObjectURL(file);
    if (type === "avatar") setAvatarPreview(preview);
    else setBannerPreview(preview);

    const form = new FormData();
    form.append("file", file);
    form.append("type", type);
    setProgress(40);
    const res = await fetch("/api/media/upload", { method: "POST", body: form });
    setProgress(90);
    const data = await res.json();
    if (data.blobRef || data.cid) {
      const ref = data.blobRef || data.cid;
      if (type === "avatar") setAvatarCid(ref);
      else setBannerCid(ref);
    }
    setProgress(100);
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
          avatarRef: avatarCid,
          bannerRef: bannerCid,
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
      if (!res.ok) throw new Error((await res.json()).error || "Save failed");

      router.push("/home");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--bg-base)] p-4">
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
              <div className="flex items-center gap-4">
                <div className="relative h-20 w-20 overflow-hidden rounded-full bg-[var(--bg-subtle)]">
                  {avatarPreview && (
                    <Image src={avatarPreview} alt="" fill className="object-cover" />
                  )}
                </div>
                <label className="btn-ghost cursor-pointer text-xs">
                  Choose file
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) =>
                      e.target.files?.[0] && uploadFile(e.target.files[0], "avatar")
                    }
                  />
                </label>
              </div>
              <p className="mt-1 text-xs text-[var(--text-muted)]">
                Image stored on Shelby · profile info saved in your account database
              </p>
            </div>

            <div>
              <p className="label-caps mb-2">Banner</p>
              <div className="relative mb-2 aspect-[4/1] overflow-hidden rounded-lg bg-[var(--bg-subtle)]">
                {bannerPreview && (
                  <Image src={bannerPreview} alt="" fill className="object-cover" />
                )}
              </div>
              <label className="btn-ghost cursor-pointer text-xs">
                Choose banner
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) =>
                    e.target.files?.[0] && uploadFile(e.target.files[0], "banner")
                  }
                />
              </label>
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
