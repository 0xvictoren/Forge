import assert from "node:assert/strict";
import test from "node:test";
import { Account, AccountAddress } from "@aptos-labs/ts-sdk";
import { MICROPAYMENTS_DEPLOYER, SenderBuiltMicropayment } from "@shelby-protocol/sdk/node";
import { buildApprovalMessage, encodeMicropayment, signMicropayment, signerFromAccount } from "../lib/agent-client/index";
import { aptToOctasBig, octasToAptString, parseRange, quoteReadOctas } from "../lib/agents/pricing";

test("our micropayment encoding is byte-identical to Shelby's SDK", () => {
  const session = Account.generate();
  const fields = {
    deployer: MICROPAYMENTS_DEPLOYER,
    sender: Account.generate().accountAddress.toString(),
    receiver: Account.generate().accountAddress.toString(),
    asset: "0xa",
    amount: BigInt(123456789),
    channelId: BigInt(7),
    sequenceNumber: BigInt(42),
  };
  const sdkMsg = SenderBuiltMicropayment.buildSignedMessage({
    deployer: AccountAddress.from(fields.deployer),
    sender: AccountAddress.from(fields.sender),
    receiver: AccountAddress.from(fields.receiver),
    fungibleAssetAddress: AccountAddress.from(fields.asset, { maxMissingChars: 63 }),
    amount: fields.amount,
    paymentChannelId: fields.channelId,
    sequenceNumber: fields.sequenceNumber,
  });
  assert.deepEqual(buildApprovalMessage(fields), sdkMsg);

  const b64 = signMicropayment(fields, signerFromAccount(session));
  const decoded = SenderBuiltMicropayment.deserialize(new Uint8Array(Buffer.from(b64, "base64")));
  assert.equal(decoded.amount, fields.amount);
  assert.equal(decoded.sequenceNumber, fields.sequenceNumber);
  assert.ok(session.publicKey.verifySignature({ message: decoded.getSignedMessage(), signature: session.sign(decoded.getSignedMessage()) }));
  assert.deepEqual(Buffer.from(decoded.bcsToBytes()), Buffer.from(encodeMicropayment({ ...fields, publicKey: decoded.publicKey, signature: decoded.signature })));
});

test("read pricing rounds up per byte with a floor", () => {
  const pricing = { enabled: true, pricePerGbApt: 1, minChargeApt: 0.0001 };
  assert.equal(quoteReadOctas(1_000_000_000, pricing), BigInt(100_000_000));
  assert.equal(quoteReadOctas(1, pricing), BigInt(10_000)); // floor
  assert.equal(quoteReadOctas(2_500_000_000, pricing), BigInt(250_000_000));
  assert.equal(aptToOctasBig(0.12345678), BigInt(12_345_678));
  assert.equal(octasToAptString(BigInt(150_000_000)), "1.5");
});

test("range parsing", () => {
  assert.deepEqual(parseRange("bytes=0-99", 1000), { start: 0, end: 99 });
  assert.deepEqual(parseRange("bytes=900-", 1000), { start: 900, end: 999 });
  assert.deepEqual(parseRange("bytes=-100", 1000), { start: 900, end: 999 });
  assert.equal(parseRange("bytes=2000-3000", 1000), "invalid");
  assert.equal(parseRange(null, 1000), null);
});
