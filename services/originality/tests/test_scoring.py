import random
import string
import unittest

from originality import fingerprints as fp
from originality.scoring import PASS_SCORE, score_upload
from originality.store import MemoryStore

KEY = b"test-key"
META = {"title": "Field notes from Lagos markets", "description": "Interviews I recorded with traders at Balogun market over six weeks in 2026, transcribed and labelled by sentiment and topic by me.", "tags": ["interviews", "markets", "nigeria"]}


def prose(seed: int, words: int = 3000) -> str:
    rng = random.Random(seed)
    vocab = ["".join(rng.choices(string.ascii_lowercase, k=rng.randint(3, 9))) for _ in range(4000)]
    out = []
    for i in range(words):
        out.append(rng.choice(vocab))
        if i % 14 == 13:
            out[-1] += "."
    return " ".join(out)


def sha(n: int) -> str:
    return f"{n:064x}"


def upload(dataset, owner, files, version=None, meta=META):
    return {"datasetId": dataset, "versionId": version or f"v-{dataset}", "ownerId": owner, "meta": meta, "files": files}


def seal(store, payload):
    report, rows = score_upload(payload, store, KEY)
    store.save_pending(payload["versionId"], payload["datasetId"], payload["ownerId"], rows)
    store.commit(payload["versionId"])
    return report


class ScoringTests(unittest.TestCase):
    def test_original_text_passes(self):
        store = MemoryStore()
        r, _ = score_upload(upload("d1", "alice", [{"sha256": sha(1), "path": "notes.txt", "kind": "text", "sizeBytes": 20000, "text": prose(1)}]), store, KEY)
        self.assertTrue(r["passed"], r)
        self.assertGreaterEqual(r["score"], 7)

    def test_copied_text_fails(self):
        store = MemoryStore()
        seal(store, upload("d1", "alice", [{"sha256": sha(1), "path": "a.txt", "kind": "text", "sizeBytes": 20000, "text": prose(1)}]))
        # Same passage, different bytes (whitespace + case), different seller.
        copy = prose(1).upper().replace(" ", "  ")
        r, _ = score_upload(upload("d2", "bob", [{"sha256": sha(2), "path": "mine.txt", "kind": "text", "sizeBytes": 20000, "text": copy}]), store, KEY)
        self.assertFalse(r["passed"])
        self.assertLessEqual(r["score"], 1.5)
        self.assertEqual(r["matches"][0]["datasetId"], "d1")
        self.assertTrue(r["tips"])

    def test_partial_copy_is_penalised(self):
        store = MemoryStore()
        seal(store, upload("d1", "alice", [{"sha256": sha(1), "path": "a.txt", "kind": "text", "sizeBytes": 20000, "text": prose(1)}]))
        half = " ".join(prose(1).split()[:1500]) + " " + " ".join(prose(9).split()[:1500])
        r, _ = score_upload(upload("d2", "bob", [{"sha256": sha(2), "path": "b.txt", "kind": "text", "sizeBytes": 20000, "text": half}]), store, KEY)
        self.assertFalse(r["passed"], r)

    def test_exact_file_duplicate(self):
        store = MemoryStore()
        seal(store, upload("d1", "alice", [{"sha256": sha(7), "path": "clip.mp4", "kind": "binary", "sizeBytes": 1e7}]))
        r, _ = score_upload(upload("d2", "bob", [{"sha256": sha(7), "path": "clip.mp4", "kind": "binary", "sizeBytes": 1e7}]), store, KEY)
        self.assertFalse(r["passed"])

    def test_new_version_of_own_dataset_not_penalised(self):
        store = MemoryStore()
        seal(store, upload("d1", "alice", [{"sha256": sha(1), "path": "a.txt", "kind": "text", "sizeBytes": 20000, "text": prose(1)}], version="v1"))
        r, _ = score_upload(upload("d1", "alice", [{"sha256": sha(1), "path": "a.txt", "kind": "text", "sizeBytes": 20000, "text": prose(1)}], version="v2"), store, KEY)
        self.assertTrue(r["passed"])

    def test_pending_drafts_do_not_block(self):
        store = MemoryStore()
        _, rows = score_upload(upload("d1", "alice", [{"sha256": sha(1), "path": "a.txt", "kind": "text", "sizeBytes": 20000, "text": prose(1)}]), store, KEY)
        store.save_pending("v-d1", "d1", "alice", rows)
        r, _ = score_upload(upload("d2", "bob", [{"sha256": sha(2), "path": "a.txt", "kind": "text", "sizeBytes": 20000, "text": prose(1)}]), store, KEY)
        self.assertTrue(r["passed"])

    def test_scraped_pages_capped(self):
        store = MemoryStore()
        junk = " ".join(
            f"<div class='nav'>Skip to content</div> {prose(i, 120)} We use cookies. Accept cookies. Share on Facebook. Subscribe to our newsletter. Read more. All rights reserved. Privacy policy."
            for i in range(30)
        )
        r, _ = score_upload(upload("d1", "alice", [{"sha256": sha(3), "path": "page.html", "kind": "text", "sizeBytes": 40000, "text": junk}]), store, KEY)
        self.assertLessEqual(r["score"], 4.5)
        self.assertFalse(r["passed"])

    def test_near_duplicate_images(self):
        store = MemoryStore()
        rng = random.Random(4)
        img = [rng.randint(0, 255) for _ in range(1024)]
        # Smooth it so it behaves like a photo rather than noise.
        img = [sum(img[(i + d) % 1024] for d in range(-2, 3)) // 5 for i in range(1024)]
        seal(store, upload("d1", "alice", [{"sha256": sha(10), "path": "a.jpg", "kind": "image", "sizeBytes": 3e6, "gray32": img, "width": 3000, "height": 2000, "hasCameraMetadata": True}]))
        brighter = [min(255, v + 12) for v in img]
        r, _ = score_upload(upload("d2", "bob", [{"sha256": sha(11), "path": "b.jpg", "kind": "image", "sizeBytes": 2e5, "gray32": brighter, "width": 800, "height": 600}]), store, KEY)
        self.assertFalse(r["passed"], r)

    def test_internal_duplicates_lower_score(self):
        store = MemoryStore()
        one = [{"sha256": sha(1), "path": "a.txt", "kind": "text", "sizeBytes": 20000, "text": prose(1)}]
        dup = one + [{"sha256": sha(2), "path": f"copy{i}.txt", "kind": "text", "sizeBytes": 20000, "text": prose(1)} for i in range(3)]
        a, _ = score_upload(upload("d1", "alice", one), store, KEY)
        b, _ = score_upload(upload("d1", "alice", dup), store, KEY)
        self.assertLess(b["score"], a["score"])

    def test_phash_stable_under_brightness(self):
        rng = random.Random(5)
        img = [rng.randint(0, 255) for _ in range(1024)]
        self.assertLessEqual(fp.hamming(fp.phash(img), fp.phash([min(255, v + 5) for v in img])), 6)

    def test_threshold(self):
        self.assertEqual(PASS_SCORE, 5.0)


if __name__ == "__main__":
    unittest.main()
