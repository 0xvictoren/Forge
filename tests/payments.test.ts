import assert from "node:assert/strict";
import test from "node:test";
import { PLATFORM_FEE_BPS } from "../lib/constants";
import { aptToOctas, calcFee, octasToApt } from "../lib/payments";

test("uses the approved five-percent platform fee", () => {
  assert.equal(PLATFORM_FEE_BPS, 500);
  assert.deepEqual(calcFee(100, PLATFORM_FEE_BPS), {
    feeApt: 5,
    netApt: 95,
  });
});

test("converts testnet APT values using exact atomic units", () => {
  assert.equal(aptToOctas(1.25), BigInt(125_000_000));
  assert.equal(octasToApt(BigInt(125_000_000)), 1.25);
});
