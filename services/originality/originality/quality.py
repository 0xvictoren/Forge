"""Signals of added value that do not need any other data to compare against."""

from __future__ import annotations

import csv
import io
import json
import re
import zlib
from collections import Counter

# Phrases that turn up when web pages are scraped wholesale.
SCRAPE_MARKERS = [
    "accept cookies", "cookie policy", "we use cookies", "all rights reserved", "subscribe to our newsletter",
    "sign up for our newsletter", "click here", "read more", "share on facebook", "share on twitter",
    "follow us on", "advertisement", "related articles", "you may also like", "privacy policy",
    "terms of service", "skip to content", "leave a comment", "posted by", "copyright ©",
    "continue reading", "trending now", "most popular", "sponsored content", "back to top",
]
_TAG = re.compile(r"<\s*(div|span|script|style|a|p|li|nav|footer|header|meta|img)\b", re.I)

LABEL_KEYS = {
    "label", "labels", "answer", "response", "output", "target", "annotation", "annotations", "category",
    "class", "rating", "score", "sentiment", "intent", "summary", "completion", "chosen", "rejected",
    "bbox", "boxes", "caption", "transcript", "translation", "explanation", "rationale",
}


def compression_ratio(text: str) -> float:
    raw = text.encode("utf-8")
    if len(raw) < 200:
        return 0.5
    return len(zlib.compress(raw, 6)) / len(raw)


def lexical_diversity(words: list[str], window: int = 500) -> float:
    """Moving-average type/token ratio, stable across text lengths."""
    if not words:
        return 0.0
    if len(words) <= window:
        return len(set(words)) / len(words)
    step = max(1, (len(words) - window) // 40)
    ratios = [len(set(words[i : i + window])) / window for i in range(0, len(words) - window + 1, step)]
    return sum(ratios) / len(ratios)


def duplicate_line_ratio(text: str) -> float:
    lines = [ln.strip().lower() for ln in text.splitlines() if len(ln.strip()) > 20]
    if len(lines) < 5:
        return 0.0
    counts = Counter(lines)
    dupes = sum(c - 1 for c in counts.values() if c > 1)
    return dupes / len(lines)


def scrape_score(text: str) -> float:
    """0 = clean, 1 = looks like raw scraped pages."""
    low = text.lower()
    per_10k = max(1.0, len(low) / 10_000)
    hits = sum(low.count(m) for m in SCRAPE_MARKERS)
    tags = len(_TAG.findall(text))
    signal = (hits / per_10k) / 6 + (tags / per_10k) / 40
    return max(0.0, min(1.0, signal))


def structure(text: str, path: str) -> dict:
    """Detect records and annotation fields in JSON, JSONL and CSV."""
    p = path.lower()
    keys: set[str] = set()
    records = 0
    try:
        if p.endswith((".jsonl", ".ndjson")):
            for line in text.splitlines()[:500]:
                line = line.strip()
                if not line:
                    continue
                try:
                    obj = json.loads(line)
                except ValueError:
                    continue
                if isinstance(obj, dict):
                    records += 1
                    keys.update(k.lower() for k in obj)
        elif p.endswith(".json"):
            obj = json.loads(text)
            items = obj if isinstance(obj, list) else next((v for v in obj.values() if isinstance(v, list)), []) if isinstance(obj, dict) else []
            for it in items[:500]:
                if isinstance(it, dict):
                    records += 1
                    keys.update(k.lower() for k in it)
        elif p.endswith((".csv", ".tsv")):
            reader = csv.reader(io.StringIO(text[:200_000]), delimiter="\t" if p.endswith(".tsv") else ",")
            header = next(reader, [])
            keys.update(h.strip().lower() for h in header)
            records = sum(1 for _ in reader)
    except (ValueError, csv.Error, StopIteration):
        pass
    labelled = bool(keys & LABEL_KEYS) or any(k.endswith(("_label", "_answer", "_annotation")) for k in keys)
    return {"records": records, "fields": len(keys), "labelled": labelled}
