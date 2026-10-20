"""Where fingerprints live. MongoDB in production, in memory for tests.

Fingerprints are written as "pending" when a version is checked and only
become comparable once the version is sealed, so abandoned drafts never block
anyone. Pending rows expire after a week.
"""

from __future__ import annotations

import datetime as dt
from typing import Protocol

PENDING_TTL = dt.timedelta(days=7)


class Store(Protocol):
    def exact(self, shas: list[str], exclude_dataset: str) -> dict[str, list[dict]]: ...
    def text_matches(self, hashes: list[int], exclude_dataset: str) -> list[dict]: ...
    def image_matches(self, chunks: list[str], exclude_dataset: str) -> list[dict]: ...
    def save_pending(self, version_id: str, dataset_id: str, owner_id: str, rows: list[dict]) -> None: ...
    def commit(self, version_id: str) -> int: ...
    def delete_dataset(self, dataset_id: str) -> int: ...


class MongoStore:
    def __init__(self, url: str, collection: str = "originality_fingerprints"):
        from pymongo import ASCENDING, MongoClient

        client = MongoClient(url, serverSelectionTimeoutMS=8000)
        self.col = client.get_default_database()[collection]
        self.col.create_index([("hashes", ASCENDING)], sparse=True)
        self.col.create_index([("chunks", ASCENDING)], sparse=True)
        self.col.create_index([("sha", ASCENDING)])
        self.col.create_index([("versionId", ASCENDING)])
        self.col.create_index([("datasetId", ASCENDING)])
        self.col.create_index("expiresAt", expireAfterSeconds=0)

    def exact(self, shas, exclude_dataset):
        out: dict[str, list[dict]] = {}
        for row in self.col.find(
            {"sha": {"$in": shas}, "state": "sealed", "datasetId": {"$ne": exclude_dataset}},
            {"sha": 1, "datasetId": 1, "ownerId": 1},
        ):
            out.setdefault(row["sha"], []).append({"datasetId": row["datasetId"], "ownerId": row["ownerId"]})
        return out

    def text_matches(self, hashes, exclude_dataset):
        if not hashes:
            return []
        pipeline = [
            {"$match": {"hashes": {"$in": hashes}, "state": "sealed", "datasetId": {"$ne": exclude_dataset}}},
            {"$project": {"datasetId": 1, "ownerId": 1, "common": {"$setIntersection": ["$hashes", hashes]}}},
            {"$limit": 400},
        ]
        return [
            {"datasetId": r["datasetId"], "ownerId": r["ownerId"], "common": set(r["common"])}
            for r in self.col.aggregate(pipeline, allowDiskUse=True)
        ]

    def image_matches(self, chunks, exclude_dataset):
        if not chunks:
            return []
        rows = self.col.find(
            {"chunks": {"$in": chunks}, "state": "sealed", "datasetId": {"$ne": exclude_dataset}},
            {"datasetId": 1, "ownerId": 1, "phashes": 1},
        ).limit(2000)
        return [{"datasetId": r["datasetId"], "ownerId": r["ownerId"], "phashes": [int(p, 16) for p in r.get("phashes", [])]} for r in rows]

    def save_pending(self, version_id, dataset_id, owner_id, rows):
        now = dt.datetime.now(dt.timezone.utc)
        shas = [r["sha"] for r in rows]
        self.col.delete_many({"versionId": version_id, "sha": {"$in": shas}, "state": "pending"})
        if rows:
            self.col.insert_many(
                [
                    {**r, "versionId": version_id, "datasetId": dataset_id, "ownerId": owner_id, "state": "pending", "createdAt": now, "expiresAt": now + PENDING_TTL}
                    for r in rows
                ]
            )

    def commit(self, version_id):
        res = self.col.update_many({"versionId": version_id, "state": "pending"}, {"$set": {"state": "sealed"}, "$unset": {"expiresAt": ""}})
        return res.modified_count

    def delete_dataset(self, dataset_id):
        return self.col.delete_many({"datasetId": dataset_id}).deleted_count


class MemoryStore:
    def __init__(self):
        self.rows: list[dict] = []

    def _live(self, exclude_dataset):
        return [r for r in self.rows if r["state"] == "sealed" and r["datasetId"] != exclude_dataset]

    def exact(self, shas, exclude_dataset):
        want = set(shas)
        out: dict[str, list[dict]] = {}
        for r in self._live(exclude_dataset):
            if r["sha"] in want:
                out.setdefault(r["sha"], []).append({"datasetId": r["datasetId"], "ownerId": r["ownerId"]})
        return out

    def text_matches(self, hashes, exclude_dataset):
        h = set(hashes)
        out = []
        for r in self._live(exclude_dataset):
            common = h & set(r.get("hashes") or [])
            if common:
                out.append({"datasetId": r["datasetId"], "ownerId": r["ownerId"], "common": common})
        return out

    def image_matches(self, chunks, exclude_dataset):
        c = set(chunks)
        return [
            {"datasetId": r["datasetId"], "ownerId": r["ownerId"], "phashes": [int(p, 16) for p in r.get("phashes", [])]}
            for r in self._live(exclude_dataset)
            if c & set(r.get("chunks") or [])
        ]

    def save_pending(self, version_id, dataset_id, owner_id, rows):
        shas = {r["sha"] for r in rows}
        self.rows = [r for r in self.rows if not (r["versionId"] == version_id and r["sha"] in shas and r["state"] == "pending")]
        self.rows += [{**r, "versionId": version_id, "datasetId": dataset_id, "ownerId": owner_id, "state": "pending"} for r in rows]

    def commit(self, version_id):
        n = 0
        for r in self.rows:
            if r["versionId"] == version_id and r["state"] == "pending":
                r["state"] = "sealed"
                n += 1
        return n

    def delete_dataset(self, dataset_id):
        before = len(self.rows)
        self.rows = [r for r in self.rows if r["datasetId"] != dataset_id]
        return before - len(self.rows)
