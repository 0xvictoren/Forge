import assert from "node:assert/strict";
import test from "node:test";
import { redactSensitiveResponse } from "../lib/security-response";

test("redacts encryption material recursively", () => {
  const input = {
    id: "asset-1",
    wrappedKeyOwner: "owner-secret",
    nested: {
      wrappedKeyShare: "share-wrap",
      encryptionShareKey: "share-secret",
      dataBase64: "raw-data",
      title: "safe",
    },
  };

  assert.deepEqual(redactSensitiveResponse(input), {
    id: "asset-1",
    nested: { title: "safe" },
  });
});

test("redacts direct storage references from public responses", () => {
  const input = {
    blobRef: "private-blob",
    file: { blobId: "private-file", fileName: "dataset.jsonl" },
    title: "Public metadata",
  };

  assert.deepEqual(
    redactSensitiveResponse(input, { redactStorageReferences: true }),
    { file: { fileName: "dataset.jsonl" }, title: "Public metadata" }
  );
});
