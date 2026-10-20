"""The originality score: 0 to 10, uploads below PASS_SCORE are turned back.

    raw   = 10 x (0.50 U + 0.15 I + 0.25 V + 0.10 D)
    score = min(raw, 1 + 9 U^3)          (and at most 4.5 for scraped pages)

U  uniqueness     share of the upload not already on Forge (or the web, once on)
I  internal       share of the upload that is not a duplicate of itself
V  added value    labels, structure, original capture, density, no scrape junk
D  documentation  description, tags and title

The cap on U means a dataset that is mostly someone else's data cannot score
its way through on polish: about a quarter copied already fails.
"""

from __future__ import annotations

import math
import re
from dataclasses import dataclass, field

from . import fingerprints as fp
from . import quality as q
from .store import Store
from .web import get_provider

ENGINE = "forge-originality/1"
PASS_SCORE = 5.0
NEAR_DUP_BITS = 6
SAME_OWNER_WEIGHT = 0.5
MAX_TEXT_CHARS = 600_000


@dataclass
class FileReport:
    sha256: str
    path: str
    kind: str
    weight: float
    coverage: float = 0.0
    internal_dup: bool = False
    value: float = 0.5
    scrape: float = 0.0
    labelled: bool = False
    notes: list[str] = field(default_factory=list)
    hashes: list[int] = field(default_factory=list)
    phashes: list[int] = field(default_factory=list)


def _clamp(x: float, lo: float = 0.0, hi: float = 1.0) -> float:
    return max(lo, min(hi, x))


def _ramp(x: float, lo: float, hi: float) -> float:
    return _clamp((x - lo) / (hi - lo))


def _distinctive_sentences(text: str, n: int = 4) -> list[str]:
    sentences = [s.strip() for s in re.split(r"(?<=[.!?])\s+", text[:200_000]) if 60 <= len(s.strip()) <= 300]
    sentences.sort(key=lambda s: len(set(s.lower().split())), reverse=True)
    return sentences[:n]


def _documentation(meta: dict) -> float:
    desc = (meta.get("description") or "").strip()
    tags = [t for t in meta.get("tags") or [] if str(t).strip()]
    title_words = len((meta.get("title") or "").split())
    return 0.6 * _ramp(len(desc), 20, 200) + 0.25 * _ramp(len(tags), 0, 3) + 0.15 * _ramp(title_words, 1, 3)


def score_upload(payload: dict, store: Store, key: bytes) -> tuple[dict, list[dict]]:
    """Score one batch. Returns (report, fingerprint rows to keep as pending)."""
    dataset_id = payload["datasetId"]
    owner_id = payload["ownerId"]
    meta = payload.get("meta") or {}
    files_in = payload.get("files") or []
    reports: list[FileReport] = []
    sentences: list[str] = []

    for f in files_in:
        kind = f.get("kind", "binary")
        size = max(1.0, float(f.get("sizeBytes") or 1))
        r = FileReport(sha256=f["sha256"].lower(), path=f.get("path", ""), kind=kind, weight=math.sqrt(size))
        if kind == "text" and f.get("text"):
            text = f["text"][:MAX_TEXT_CHARS]
            words = fp.normalize_text(text)
            r.hashes = fp.text_hashes(words, key)
            r.scrape = q.scrape_score(text)
            info = q.structure(text, r.path)
            r.labelled = info["labelled"] and info["records"] > 0
            div = _ramp(q.lexical_diversity(words), 0.25, 0.6)
            comp = _ramp(q.compression_ratio(text), 0.1, 0.3)
            dup_lines = q.duplicate_line_ratio(text)
            base = 0.35 * div + 0.35 * comp + 0.3 * (1 - r.scrape)
            bonus = 0.25 if r.labelled else (0.05 if info["records"] > 0 else 0.0)
            r.value = _clamp(0.75 * base + bonus - 0.5 * dup_lines)
            if len(words) < 40:
                r.notes.append("very little text")
            if dup_lines > 0.3:
                r.notes.append(f"{round(dup_lines * 100)}% repeated lines")
            sentences += _distinctive_sentences(text, 2)
        elif kind in ("image", "video"):
            frames = f.get("frames") or ([f["gray32"]] if f.get("gray32") else [])
            r.phashes = [fp.phash(g) for g in frames[:8] if len(g) == 1024]
            short = min(int(f.get("width") or 0), int(f.get("height") or 0))
            v = 0.5 + (0.3 if f.get("hasCameraMetadata") else 0.0)
            v += 0.2 if short >= 512 else (-0.3 if 0 < short < 200 else 0.0)
            if kind == "video" and len(r.phashes) > 1:
                distinct = len({p for p in r.phashes if all(fp.hamming(p, o) > NEAR_DUP_BITS for o in r.phashes if o != p)})
                v += 0.1 if distinct >= len(r.phashes) // 2 else -0.2
            r.value = _clamp(v)
            if 0 < short < 200:
                r.notes.append("low resolution")
        reports.append(r)

    if not reports:
        raise ValueError("No files to check")

    # ── exact duplicates ────────────────────────────────────────────────────
    exact = store.exact(list({r.sha256 for r in reports}), dataset_id)
    match_share: dict[str, float] = {}

    def credit(r: FileReport, cov: float, owners: list[dict]):
        r.coverage = max(r.coverage, cov)
        for o in owners:
            match_share[o["datasetId"]] = match_share.get(o["datasetId"], 0.0) + cov * r.weight

    for r in reports:
        if r.sha256 in exact:
            hits = exact[r.sha256]
            other = [h for h in hits if h["ownerId"] != owner_id]
            credit(r, 1.0 if other else SAME_OWNER_WEIGHT, other or hits)
            r.notes.append("identical file already on Forge")

    # ── near-duplicate text ─────────────────────────────────────────────────
    all_hashes = sorted({h for r in reports for h in r.hashes})
    if all_hashes:
        cands = store.text_matches(all_hashes, dataset_id)
        other_cover: set[int] = set().union(*[c["common"] for c in cands if c["ownerId"] != owner_id]) if cands else set()
        self_cover: set[int] = set().union(*[c["common"] for c in cands if c["ownerId"] == owner_id]) if cands else set()
        for r in reports:
            if len(r.hashes) < 8:
                continue
            hs = set(r.hashes)
            other = len(hs & other_cover)
            mine = len((hs & self_cover) - other_cover)
            cov = (other + SAME_OWNER_WEIGHT * mine) / len(hs)
            if cov > 0.05:
                involved = [c for c in cands if c["common"] & hs]
                for c in involved:
                    share = len(c["common"] & hs) / len(hs)
                    match_share[c["datasetId"]] = match_share.get(c["datasetId"], 0.0) + share * r.weight
                r.coverage = max(r.coverage, cov)
                if cov >= 0.2:
                    r.notes.append(f"{round(cov * 100)}% of the text is already on Forge")

    # ── near-duplicate images and video frames ──────────────────────────────
    chunks = sorted({c for r in reports for p in r.phashes for c in fp.phash_chunks(p)})
    if chunks:
        cands = store.image_matches(chunks, dataset_id)
        for r in reports:
            if not r.phashes:
                continue
            hit_frames = 0
            hit_owners: dict[str, dict] = {}
            for p in r.phashes:
                for c in cands:
                    if any(fp.hamming(p, o) <= NEAR_DUP_BITS for o in c["phashes"]):
                        hit_frames += 1
                        hit_owners[c["datasetId"]] = c
                        break
            if hit_frames:
                share = hit_frames / len(r.phashes)
                others = [c for c in hit_owners.values() if c["ownerId"] != owner_id]
                credit(r, share if others else share * SAME_OWNER_WEIGHT, others or list(hit_owners.values()))
                r.notes.append("near-identical image already on Forge" if r.kind == "image" else f"{hit_frames} of {len(r.phashes)} frames already on Forge")

    # ── duplicates inside the upload ────────────────────────────────────────
    seen_sha: set[str] = set()
    seen_text: set[int] = set()
    seen_img: list[int] = []
    for r in reports:
        if r.sha256 in seen_sha:
            r.internal_dup = True
        seen_sha.add(r.sha256)
        if len(r.hashes) >= 8:
            hs = set(r.hashes)
            if len(hs & seen_text) / len(hs) >= 0.6:
                r.internal_dup = True
            seen_text |= hs
        if r.kind == "image" and r.phashes:
            p = r.phashes[0]
            if any(fp.hamming(p, o) <= NEAR_DUP_BITS for o in seen_img):
                r.internal_dup = True
            seen_img.append(p)

    # ── web (off until a provider is configured) ────────────────────────────
    provider = get_provider()
    web_cov = provider.coverage(sentences[:12]) if provider and sentences else None

    # ── combine ─────────────────────────────────────────────────────────────
    total_w = sum(r.weight for r in reports)
    U = 1 - sum(r.coverage * r.weight for r in reports) / total_w
    if web_cov is not None:
        U = min(U, 1 - web_cov)
    I = 1 - sum(r.weight for r in reports if r.internal_dup) / total_w
    V = sum(r.value * r.weight for r in reports) / total_w
    D = _documentation(meta)
    text_w = sum(r.weight for r in reports if r.kind == "text") or 0.0
    scrape = sum(r.scrape * r.weight for r in reports if r.kind == "text") / text_w if text_w else 0.0

    raw = 10 * (0.5 * U + 0.15 * I + 0.25 * V + 0.10 * D)
    cap = 1 + 9 * U**3
    if scrape > 0.5 and text_w / total_w > 0.5:
        cap = min(cap, 4.5)
    score = round(min(raw, cap), 1)
    passed = score >= PASS_SCORE

    tips: list[str] = []
    copied = [r for r in reports if r.coverage >= 0.2]
    if copied:
        tips.append(
            f"{len(copied)} of {len(reports)} files are already on Forge. Remove them, or replace them with data you collected or created yourself."
        )
    if scrape > 0.3:
        tips.append("Parts of your text look copied from web pages (cookie banners, share links, menus). Upload your own writing or recordings instead of scraped pages.")
    dups = sum(1 for r in reports if r.internal_dup)
    if dups:
        tips.append(f"{dups} files are duplicates of other files in this upload. Remove the repeats.")
    texts = [r for r in reports if r.kind == "text"]
    if texts and not any(r.labelled for r in texts):
        tips.append("Add your own labels or annotations (for example a label, answer or rating field). That is the added value buyers pay for.")
    images = [r for r in reports if r.kind == "image"]
    if images and not any("low resolution" not in r.notes and r.value >= 0.8 for r in images):
        tips.append("Upload original, full-resolution images straight from the camera so their capture metadata shows they are yours.")
    if D < 0.6:
        tips.append("Describe how and when you collected this data and what makes it different, in at least two or three sentences.")

    findings = []
    for r in reports:
        for n in r.notes:
            findings.append({"path": r.path, "message": n})

    matches = sorted(({"datasetId": d, "share": round(min(1.0, s / total_w), 3)} for d, s in match_share.items()), key=lambda m: -m["share"])[:5]

    report = {
        "engine": ENGINE,
        "score": score,
        "passed": passed,
        "threshold": PASS_SCORE,
        "components": {
            "uniqueness": round(10 * U, 1),
            "internal": round(10 * I, 1),
            "value": round(10 * V, 1),
            "documentation": round(10 * D, 1),
        },
        "webChecked": web_cov is not None,
        "tips": tips[:5] if not passed else tips[:3],
        "findings": findings[:50],
        "matches": matches,
        "checkedShas": sorted({r.sha256 for r in reports}),
        "fileCount": len(reports),
    }

    rows = []
    for r in reports:
        row: dict = {"sha": r.sha256, "kind": r.kind}
        if r.hashes:
            row["hashes"] = r.hashes
        if r.phashes:
            row["phashes"] = [fp.phash_hex(p) for p in r.phashes]
            row["chunks"] = sorted({c for p in r.phashes for c in fp.phash_chunks(p)})
        rows.append(row)
    return report, rows
