"""Forge originality service.

Only Forge's Next.js server calls this, with the shared ORIGINALITY_SERVICE_SECRET.
Content arrives as text samples and 32x32 thumbnails, is fingerprinted and
discarded. Nothing but keyed hashes is stored.
"""

from __future__ import annotations

import hmac
import os

from fastapi import Depends, FastAPI, Header, HTTPException
from pydantic import BaseModel, Field

from .scoring import ENGINE, score_upload
from .store import MemoryStore, MongoStore, Store

SECRET = os.environ.get("ORIGINALITY_SERVICE_SECRET", "")
DB_URL = os.environ.get("DATABASE_URL", "")

app = FastAPI(title="Forge originality", version="1")
_store: Store | None = None


def store() -> Store:
    global _store
    if _store is None:
        _store = MongoStore(DB_URL) if DB_URL else MemoryStore()
    return _store


def _key() -> bytes:
    return (SECRET or "dev-only-key").encode()[:64]


def authorize(x_forge_key: str = Header(default="")):
    if not SECRET or not hmac.compare_digest(x_forge_key, SECRET):
        raise HTTPException(status_code=401, detail="Unauthorized")


class FileIn(BaseModel):
    sha256: str = Field(pattern=r"^[0-9a-fA-F]{64}$")
    path: str = Field(default="", max_length=512)
    sizeBytes: float = 0
    mime: str = ""
    kind: str = Field(default="binary", pattern=r"^(text|image|video|binary)$")
    text: str | None = Field(default=None, max_length=700_000)
    gray32: list[int] | None = None
    frames: list[list[int]] | None = Field(default=None, max_length=8)
    width: int | None = None
    height: int | None = None
    hasCameraMetadata: bool | None = None


class ScoreIn(BaseModel):
    datasetId: str
    versionId: str
    ownerId: str
    meta: dict = {}
    files: list[FileIn] = Field(min_length=1, max_length=300)


@app.get("/healthz")
def healthz():
    return {"ok": True, "engine": ENGINE}


@app.post("/v1/score", dependencies=[Depends(authorize)])
def score(body: ScoreIn):
    payload = body.model_dump()
    try:
        report, rows = score_upload(payload, store(), _key())
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    if report["passed"]:
        store().save_pending(body.versionId, body.datasetId, body.ownerId, rows)
    return report


class CommitIn(BaseModel):
    versionId: str


@app.post("/v1/commit", dependencies=[Depends(authorize)])
def commit(body: CommitIn):
    return {"committed": store().commit(body.versionId)}


@app.delete("/v1/datasets/{dataset_id}", dependencies=[Depends(authorize)])
def delete_dataset(dataset_id: str):
    return {"deleted": store().delete_dataset(dataset_id)}
