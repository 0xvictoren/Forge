import assert from "node:assert/strict";
import test from "node:test";
import {
  buildForgePurchasePayload,
  calculateAtomicSettlement,
  hexBytes,
} from "../lib/forge-purchase";

test("calculates settlement exclusively in integer atomic units", () => {
  assert.deepEqual(calculateAtomicSettlement(BigInt(100_000_001), 500), {
    feeAtomic: BigInt(5_000_000),
    netAtomic: BigInt(95_000_001),
  });
});

test("binds every server purchase identifier into the contract payload", () => {
  const payload = buildForgePurchasePayload("0xcafe", {
    id: "0123456789abcdef01234567",
    recipient: "0xbeef",
    amountAtomic: "100000000",
    feeAtomic: "5000000",
    netAtomic: "95000000",
    feeBps: 500,
    productIdentifier: "abcdefabcdefabcdefabcdef",
    versionIdentifier: "11".repeat(32),
    nonce: "22".repeat(32),
    termsHash: "33".repeat(32),
    expiresAt: "2030-01-01T00:00:00.000Z",
  });

  assert.equal(
    payload.function,
    `0x${"0".repeat(60)}cafe::forge::settle_purchase`
  );
  assert.equal(payload.functionArguments[1], "100000000");
  // vector<u8> arguments must be raw bytes — strings would be UTF-8 encoded.
  const bytes = payload.functionArguments.slice(2, 7).map((a) => Buffer.from(a as Uint8Array).toString("hex"));
  assert.deepEqual(bytes, [
    "0123456789abcdef01234567",
    "abcdefabcdefabcdefabcdef",
    "11".repeat(32),
    "22".repeat(32),
    "33".repeat(32),
  ]);
  assert.equal((payload.functionArguments[6] as Uint8Array).length, 32);
});

test("rejects malformed settlement identifiers", () => {
  assert.throws(() => hexBytes("not-hex"), /hexadecimal/);
  assert.throws(() => hexBytes("abc"), /hexadecimal/);
});
