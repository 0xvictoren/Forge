import assert from "node:assert/strict";
import test from "node:test";
import { Account } from "@aptos-labs/ts-sdk";
import {
  hasExpectedWalletBindings,
  normalizeWalletAddress,
} from "../lib/wallet-auth";

test("accepts an Aptos login message bound to address, message, and nonce", () => {
  const account = Account.generate();
  const address = normalizeWalletAddress(account.accountAddress.toString());
  const message = "Forge login challenge";
  const nonce = "a".repeat(64);
  const fullMessage = [
    "APTOS",
    `address: ${address}`,
    `message: ${message}`,
    `nonce: ${nonce}`,
  ].join("\n");

  assert.equal(
    hasExpectedWalletBindings(fullMessage, { address, message, nonce }),
    true
  );
});

test("rejects missing, changed, duplicate, or extra wallet bindings", () => {
  const address = normalizeWalletAddress("0x1");
  const expected = { address, message: "expected", nonce: "b".repeat(64) };
  const validLines = [
    "APTOS",
    `address: ${address}`,
    "message: expected",
    `nonce: ${expected.nonce}`,
  ];

  assert.equal(hasExpectedWalletBindings(validLines.slice(0, 3).join("\n"), expected), false);
  assert.equal(hasExpectedWalletBindings(validLines.join("\n").replace("expected", "changed"), expected), false);
  assert.equal(hasExpectedWalletBindings([...validLines, "nonce: duplicate"].join("\n"), expected), false);
  assert.equal(hasExpectedWalletBindings([...validLines, "application: attacker"].join("\n"), expected), false);
});
