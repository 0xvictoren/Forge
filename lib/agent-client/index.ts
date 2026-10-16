/**
 * Forge agent client: pay-per-read over Shelby micropayment channels.
 *
 * Runs anywhere (Node, browsers, edge, MCP servers) and depends only on
 * @aptos-labs/ts-sdk. The wire format is byte-identical to Shelby's
 * SenderBuiltMicropayment, so one channel key works for Shelby and Forge.
 *
 *   const client = new ForgeAgentClient({ baseUrl, sender, signer: sessionKey });
 *   const bytes = await client.read(fileId, { range: [0, 1_048_575] });
 */
import { Account, AccountAddress, Aptos, AptosConfig, MoveVector, Network, Serializer, type AccountAddressInput, type InputGenerateTransactionPayloadData } from "@aptos-labs/ts-sdk";

export const MICROPAYMENTS_MODULE_NAME = "micropayments";
export const WITHDRAW_APPROVAL_STRUCT = "WithdrawApproval";

/** Anything that can sign with the channel's registered Ed25519 key. */
export type MicropaymentSigner = {
  publicKey: Uint8Array;
  sign: (message: Uint8Array) => Uint8Array;
};

export function signerFromAccount(account: Account): MicropaymentSigner {
  return { publicKey: account.publicKey.toUint8Array(), sign: (m) => account.sign(m).toUint8Array() };
}

export type ApprovalFields = {
  deployer: AccountAddressInput;
  sender: AccountAddressInput;
  receiver: AccountAddressInput;
  asset: AccountAddressInput;
  amount: bigint;
  channelId: bigint;
  sequenceNumber: bigint;
};

const addr = (a: AccountAddressInput) => AccountAddress.from(a, { maxMissingChars: 63 });

/** BCS of SignedMessage<WithdrawApproval>: TypeInfo + struct fields. */
export function buildApprovalMessage(f: ApprovalFields): Uint8Array {
  const s = new Serializer();
  addr(f.deployer).serialize(s);
  s.serializeBytes(new TextEncoder().encode(MICROPAYMENTS_MODULE_NAME));
  s.serializeBytes(new TextEncoder().encode(WITHDRAW_APPROVAL_STRUCT));
  addr(f.sender).serialize(s);
  addr(f.receiver).serialize(s);
  addr(f.asset).serialize(s);
  s.serializeU64(f.amount);
  s.serializeU64(f.channelId);
  s.serializeU64(f.sequenceNumber);
  return s.toUint8Array();
}

/** BCS of SenderBuiltMicropayment, as carried in the X-Forge-Micropayment header. */
export function encodeMicropayment(f: ApprovalFields & { publicKey: Uint8Array; signature: Uint8Array }): Uint8Array {
  const s = new Serializer();
  addr(f.sender).serialize(s);
  addr(f.receiver).serialize(s);
  addr(f.asset).serialize(s);
  s.serializeU64(f.amount);
  s.serializeU64(f.channelId);
  s.serializeU64(f.sequenceNumber);
  s.serializeBytes(f.publicKey);
  s.serializeBytes(f.signature);
  addr(f.deployer).serialize(s);
  return s.toUint8Array();
}

export function toBase64(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

export function signMicropayment(fields: ApprovalFields, signer: MicropaymentSigner): string {
  const signature = signer.sign(buildApprovalMessage(fields));
  return toBase64(encodeMicropayment({ ...fields, publicKey: signer.publicKey, signature }));
}

export type PaymentInstructions = {
  receiver: string;
  asset: string;
  micropaymentsModule: string;
  priceOctas: string;
  signAmount: string;
  signSequenceNumber: string | null;
  channel: { channelId: string; acceptedAmount: string; nextSequenceNumber: string; available: string; expiresAt: string } | null;
};

export class PaymentError extends Error {
  constructor(message: string, public status: number, public payment?: PaymentInstructions) {
    super(message);
  }
}

export type ReadResult = {
  bytes: Uint8Array;
  status: number;
  chargedOctas: bigint;
  acceptedAmount: bigint;
  licence: string | null;
  fingerprinted: boolean;
  contentType: string;
};

export class ForgeAgentClient {
  readonly baseUrl: string;
  readonly sender: string;
  private signer: MicropaymentSigner;
  private fetcher: typeof fetch;
  /** Hard ceiling on what this client will authorise per read, in octas. */
  maxPricePerReadOctas?: bigint;

  constructor(opts: { baseUrl: string; sender: AccountAddressInput; signer: MicropaymentSigner | Account; fetch?: typeof fetch; maxPricePerReadOctas?: bigint }) {
    this.baseUrl = opts.baseUrl.replace(/\/$/, "");
    this.sender = addr(opts.sender).toStringLong();
    this.signer = opts.signer instanceof Account ? signerFromAccount(opts.signer) : opts.signer;
    this.fetcher = opts.fetch ?? fetch.bind(globalThis);
    this.maxPricePerReadOctas = opts.maxPricePerReadOctas;
  }

  async discover() {
    return (await this.fetcher(`${this.baseUrl}/api/agent`)).json();
  }

  async catalog(q?: string) {
    return (await this.fetcher(`${this.baseUrl}/api/agent/datasets${q ? `?q=${encodeURIComponent(q)}` : ""}`)).json();
  }

  async dataset(idOrSlug: string) {
    return (await this.fetcher(`${this.baseUrl}/api/agent/datasets/${idOrSlug}`)).json();
  }

  async channel() {
    return (await this.fetcher(`${this.baseUrl}/api/agent/channel?sender=${this.sender}`)).json();
  }

  /**
   * Read a file (or byte range), paying exactly the quoted price. Handles the
   * 402 → sign → retry dance and re-syncs on 409 if another read raced it.
   */
  async read(fileId: string, opts?: { range?: [number, number] }): Promise<ReadResult> {
    const headers: Record<string, string> = { "x-forge-agent": this.sender };
    if (opts?.range) headers.range = `bytes=${opts.range[0]}-${opts.range[1]}`;
    const url = `${this.baseUrl}/api/agent/files/${fileId}`;

    let res = await this.fetcher(url, { headers });
    for (let attempt = 0; attempt < 4 && (res.status === 402 || res.status === 409); attempt++) {
      const body = (await res.json()) as { error: string; payment?: PaymentInstructions };
      const p = body.payment;
      if (!p?.channel || p.signSequenceNumber == null) {
        throw new PaymentError(body.error || "Open a payment channel to Forge first", res.status, p);
      }
      const price = BigInt(p.priceOctas);
      if (this.maxPricePerReadOctas !== undefined && price > this.maxPricePerReadOctas) {
        throw new PaymentError(`Read costs ${price} octas, above this client's limit`, 402, p);
      }
      if (BigInt(p.channel.available) < price) throw new PaymentError("Channel balance too low. Top it up.", 402, p);
      const header = signMicropayment(
        {
          deployer: p.micropaymentsModule,
          sender: this.sender,
          receiver: p.receiver,
          asset: p.asset,
          amount: BigInt(p.signAmount),
          channelId: BigInt(p.channel.channelId),
          sequenceNumber: BigInt(p.signSequenceNumber),
        },
        this.signer
      );
      res = await this.fetcher(url, { headers: { ...headers, "x-forge-micropayment": header } });
    }
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new PaymentError((body as { error?: string }).error || `Read failed (${res.status})`, res.status);
    }
    return {
      bytes: new Uint8Array(await res.arrayBuffer()),
      status: res.status,
      chargedOctas: BigInt(res.headers.get("x-forge-charged-octas") || "0"),
      acceptedAmount: BigInt(res.headers.get("x-forge-accepted-amount") || "0"),
      licence: res.headers.get("x-forge-licence"),
      fingerprinted: res.headers.get("x-forge-fingerprinted") === "1",
      contentType: res.headers.get("content-type") || "application/octet-stream",
    };
  }
}

/** Transaction payloads for managing a channel to Forge with any Aptos wallet. */
export const channelPayloads = {
  initialize(module: string) {
    return { function: `${module}::micropayments::initialize_payment_channels` as `${string}::${string}::${string}`, functionArguments: [] };
  },
  open(module: string, a: { receiver: string; asset: string; depositOctas: bigint; expiresAtMs: number; sessionPublicKey: Uint8Array }) {
    return {
      function: `${module}::micropayments::create_channel` as `${string}::${string}::${string}`,
      functionArguments: [a.receiver, (BigInt(a.expiresAtMs) * BigInt(1000)).toString(), a.depositOctas.toString(), a.asset, MoveVector.U8(a.sessionPublicKey)],
    };
  },
  topUp(module: string, a: { receiver: string; asset: string; amountOctas: bigint }) {
    return { function: `${module}::micropayments::increase_deposit_amount` as `${string}::${string}::${string}`, functionArguments: [a.receiver, a.asset, a.amountOctas.toString()] };
  },
  extend(module: string, a: { receiver: string; asset: string; expiresAtMs: number }) {
    return { function: `${module}::micropayments::extend_expiration_time` as `${string}::${string}::${string}`, functionArguments: [a.receiver, a.asset, (BigInt(a.expiresAtMs) * BigInt(1000)).toString()] };
  },
  close(module: string, a: { receiver: string; asset: string }) {
    return { function: `${module}::micropayments::sender_withdraw` as `${string}::${string}::${string}`, functionArguments: [a.receiver, a.asset] };
  },
};

/** Open (or top up) a channel from a funded Aptos account in Node/scripts. */
export async function openChannelWithAccount(opts: {
  wallet: Account;
  sessionPublicKey: Uint8Array;
  depositOctas: bigint;
  hours: number;
  forge: { receiver: string; asset: string; micropaymentsModule: string };
  fullnode?: string;
}) {
  const aptos = new Aptos(new AptosConfig({ network: Network.CUSTOM, fullnode: opts.fullnode ?? "https://api.shelbynet.shelby.xyz/v1" }));
  const run = async (data: InputGenerateTransactionPayloadData) => {
    const tx = await aptos.transaction.build.simple({ sender: opts.wallet.accountAddress, data, options: { maxGasAmount: 20_000, gasUnitPrice: 100 } });
    const pending = await aptos.signAndSubmitTransaction({ signer: opts.wallet, transaction: tx });
    await aptos.waitForTransaction({ transactionHash: pending.hash, options: { checkSuccess: true } });
    return pending.hash;
  };
  // Initialising twice aborts; ignore that case.
  await run(channelPayloads.initialize(opts.forge.micropaymentsModule)).catch(() => undefined);
  return run(
    channelPayloads.open(opts.forge.micropaymentsModule, {
      receiver: opts.forge.receiver,
      asset: opts.forge.asset,
      depositOctas: opts.depositOctas,
      expiresAtMs: Date.now() + opts.hours * 3600_000,
      sessionPublicKey: opts.sessionPublicKey,
    })
  );
}

// ─── Signed agent requests (feeds, memory) ───────────────────────────────────

/** The exact bytes an agent signs to authenticate a request with its channel key. */
export function agentRequestMessage(input: { method: string; path: string; timestamp: number; bodySha256: string }): Uint8Array {
  return new TextEncoder().encode(`forge-agent-request/v1\n${input.method.toUpperCase()}\n${input.path}\n${input.timestamp}\n${input.bodySha256}`);
}

async function sha256HexIso(data: Uint8Array): Promise<string> {
  const d = new Uint8Array(await crypto.subtle.digest("SHA-256", data as BufferSource));
  return Array.from(d, (b) => b.toString(16).padStart(2, "0")).join("");
}

const hex = (b: Uint8Array) => Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");

/** Headers that prove the request comes from the holder of the channel's session key. */
export async function signAgentRequest(signer: MicropaymentSigner, sender: string, method: string, url: string, body?: string) {
  const timestamp = Date.now();
  const bodySha256 = await sha256HexIso(new TextEncoder().encode(body ?? ""));
  const path = new URL(url).pathname;
  const signature = signer.sign(agentRequestMessage({ method, path, timestamp, bodySha256 }));
  return {
    "x-forge-agent": addr(sender).toStringLong(),
    "x-forge-timestamp": String(timestamp),
    "x-forge-signature": `0x${hex(signature)}`,
  };
}

/** Feed + memory helpers on top of the signed-request scheme. */
export class ForgeAgentExtras {
  constructor(private client: ForgeAgentClient, private signer: MicropaymentSigner) {}

  private async signed(method: string, path: string, body?: unknown) {
    const url = `${this.client.baseUrl}${path}`;
    const raw = body === undefined ? undefined : JSON.stringify(body);
    const headers = { ...(await signAgentRequest(this.signer, this.client.sender, method, url, raw)), ...(raw ? { "content-type": "application/json" } : {}) };
    const res = await fetch(url, { method, headers, body: raw });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new PaymentError((json as { error?: string }).error || `Request failed (${res.status})`, res.status);
    return json;
  }

  versions(datasetId: string, since = 0) {
    return fetch(`${this.client.baseUrl}/api/agent/datasets/${datasetId}/versions?since=${since}`).then((r) => r.json());
  }
  subscribe(datasetId: string, webhookUrl: string) {
    return this.signed("POST", "/api/agent/feeds", { datasetId, webhookUrl });
  }
  feeds() {
    return this.signed("GET", "/api/agent/feeds");
  }
  unsubscribe(id: string) {
    return this.signed("DELETE", `/api/agent/feeds/${id}`);
  }
  /** Record a memory checkpoint (content stored by the agent, e.g. on Shelby). */
  async remember(vault: string, content: Uint8Array, opts?: { blobRef?: string; note?: string }) {
    return this.signed("POST", `/api/agent/memory/${encodeURIComponent(vault)}`, {
      sha256: await sha256HexIso(content),
      sizeBytes: content.byteLength,
      blobRef: opts?.blobRef,
      note: opts?.note,
    });
  }
  memory(vault: string) {
    return this.signed("GET", `/api/agent/memory/${encodeURIComponent(vault)}`);
  }
}
