import assert from "node:assert/strict";
import test from "node:test";
import { checkRateLimit } from "../lib/rate-limit";

test("blocks requests beyond the configured limit", () => {
  const key = `test-${Date.now()}-${Math.random()}`;
  assert.equal(checkRateLimit(key, { limit: 2, windowMs: 60_000 }).allowed, true);
  assert.equal(checkRateLimit(key, { limit: 2, windowMs: 60_000 }).allowed, true);
  assert.equal(checkRateLimit(key, { limit: 2, windowMs: 60_000 }).allowed, false);
});
