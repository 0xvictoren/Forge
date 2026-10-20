"""Content fingerprints: what Forge keeps instead of the content itself.

Text  -> keyed hashes of 5-word shingles, kept by modular sampling so the same
         passage always yields the same fingerprints wherever it appears.
Image -> 64-bit perceptual hash (DCT of a 32x32 greyscale thumbnail), indexed
         as eight byte-chunks so near-duplicates can be found with one query.
Every file also keeps its SHA-256 for exact-duplicate checks.

Hashes are keyed with the service secret, so a leaked fingerprint table cannot
be dictionary-attacked back into text.
"""

from __future__ import annotations

import hashlib
import math
import re
import unicodedata

SHINGLE_WORDS = 5
# Keep 1 in SAMPLE_MOD shingle hashes. Same content -> same kept hashes.
SAMPLE_MOD = 16
MAX_TEXT_HASHES = 6000

_WORD = re.compile(r"[^\W_]+", re.UNICODE)


def normalize_text(text: str) -> list[str]:
    text = unicodedata.normalize("NFKC", text).lower()
    return _WORD.findall(text)


def _h64(key: bytes, data: str) -> int:
    return int.from_bytes(hashlib.blake2b(data.encode("utf-8"), digest_size=8, key=key).digest(), "big")


def text_hashes(words: list[str], key: bytes) -> list[int]:
    """Sampled shingle hashes as signed 63-bit ints (MongoDB-friendly), sorted."""
    if len(words) < SHINGLE_WORDS:
        return []
    kept: set[int] = set()
    for i in range(len(words) - SHINGLE_WORDS + 1):
        h = _h64(key, " ".join(words[i : i + SHINGLE_WORDS]))
        if h % SAMPLE_MOD == 0:
            kept.add(h >> 1)
    out = sorted(kept)
    if len(out) > MAX_TEXT_HASHES:
        # Deterministic thinning keeps the smallest values, so it stays consistent.
        out = out[:MAX_TEXT_HASHES]
    return out


# ─── images ──────────────────────────────────────────────────────────────────

_N = 32
_COS = [[math.cos(math.pi * (2 * x + 1) * u / (2 * _N)) for x in range(_N)] for u in range(8)]


def phash(gray: list[int]) -> int:
    """pHash of a 32x32 greyscale image given as 1024 values in 0..255."""
    if len(gray) != _N * _N:
        raise ValueError("gray32 must have 1024 values")
    rows = [gray[r * _N : (r + 1) * _N] for r in range(_N)]
    # Separable DCT-II, but only the 8 lowest frequencies are needed.
    row_coeffs = [[sum(row[x] * _COS[u][x] for x in range(_N)) for u in range(8)] for row in rows]
    coeffs = []
    for v in range(8):
        for u in range(8):
            coeffs.append(sum(row_coeffs[y][u] * _COS[v][y] for y in range(_N)))
    ac = coeffs[1:]  # drop the DC term, it only encodes brightness
    median = sorted(ac)[len(ac) // 2]
    bits = 0
    for c in coeffs:
        bits = (bits << 1) | (1 if c > median else 0)
    return bits


def phash_chunks(h: int) -> list[str]:
    """Eight 8-bit chunks. Two hashes within Hamming distance 7 share at least one."""
    return [f"{i}:{(h >> (56 - 8 * i)) & 0xFF:02x}" for i in range(8)]


def hamming(a: int, b: int) -> int:
    return (a ^ b).bit_count()


def phash_hex(h: int) -> str:
    return f"{h:016x}"
