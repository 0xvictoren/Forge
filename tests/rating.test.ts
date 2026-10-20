import { test } from "node:test";
import assert from "node:assert/strict";
import { combineRating } from "../lib/datasets/rating-math";

const none = { viewers: 0, agentsLooked: 0, humanBuyers: 0, agentBuyers: 0, repeatAgents: 0, walkaways: 0, ratings: [] as number[] };

test("a new listing is rated by its originality alone", () => {
  assert.equal(combineRating({ ...none, originality: 8.2 }).rating, 8.2);
});

test("agents that look and walk away pull the rating down", () => {
  const r = combineRating({ ...none, originality: 8, viewers: 40, agentsLooked: 30, agentBuyers: 2, walkaways: 28 });
  assert.ok(r.rating < 8, `got ${r.rating}`);
});

test("agents that keep coming back lift it", () => {
  const r = combineRating({ ...none, originality: 6, viewers: 20, agentsLooked: 10, agentBuyers: 8, repeatAgents: 7, walkaways: 2 });
  assert.ok(r.rating > 6, `got ${r.rating}`);
});

test("buyer ratings count double and move the score", () => {
  const low = combineRating({ ...none, originality: 8, humanBuyers: 3, viewers: 10, ratings: [2, 3, 2] });
  assert.ok(low.rating < 6, `got ${low.rating}`);
});

test("rating stays within 0 to 10", () => {
  const r = combineRating({ ...none, originality: 10, viewers: 1, humanBuyers: 50, agentBuyers: 50, repeatAgents: 50, ratings: Array(50).fill(10) });
  assert.ok(r.rating <= 10 && r.rating >= 0);
});
