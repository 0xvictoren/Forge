"use client";

import {
  AccountAddress,
  AccountAuthenticatorEd25519,
  Ed25519PublicKey,
  Ed25519Signature,
  generateSigningMessageForTransaction,
  Hex,
  Network,
  SigningScheme,
  type AnyRawTransaction,
} from "@aptos-labs/ts-sdk";
import {
  AccountInfo,
  UserResponseStatus,
  type AptosSignAndSubmitTransactionInput,
  type AptosSignMessageInput,
  type AptosWallet,
  type AptosWalletAccount,
  type NetworkInfo,
} from "@aptos-labs/wallet-standard";
import { getAptosBrowserClient } from "@/lib/aptos-browser";

/**
 * "Forge account": an AIP-62 wallet backed by the user's Privy embedded Aptos
 * key. It registers with the Aptos wallet adapter like any extension wallet,
 * so every upload, seal and purchase in the app works unchanged for people who
 * signed in with email. Signing never leaves Privy; Forge pays the gas.
 */

export const FORGE_ACCOUNT_WALLET = "Forge account";

export type PrivySigner = {
  address: string;
  publicKey: string;
  signRawHash: (hex: `0x${string}`) => Promise<`0x${string}`>;
};

const ICON =
  "data:image/svg+xml;base64," +
  btoa(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="16" fill="#F4770A"/><path d="M22 18h22v7H30v6h12v7H30v8h-8z" fill="#fff"/></svg>`
  );

const NETWORK: NetworkInfo = { name: Network.SHELBYNET, chainId: 0 };
const approved = <T>(args: T) => ({ status: UserResponseStatus.APPROVED as const, args });

class ForgeAccountWallet implements AptosWallet {
  readonly version = "1.0.0" as const;
  readonly name = FORGE_ACCOUNT_WALLET;
  readonly icon = ICON as `data:image/svg+xml;base64,${string}`;
  readonly url = "https://forge.app";
  readonly chains = ["aptos:shelbynet"] as const;

  private signer: PrivySigner | null = null;
  private waiters: ((s: PrivySigner | null) => void)[] = [];
  private accountListeners: ((a: AccountInfo) => void)[] = [];

  /** Called by the Privy bridge once the user is signed in (or out). */
  setSigner(signer: PrivySigner | null) {
    this.signer = signer;
    this.waiters.splice(0).forEach((w) => w(signer));
    if (signer) this.accountListeners.forEach((l) => l(this.info(signer)));
  }

  private waitForSigner(ms = 12_000): Promise<PrivySigner> {
    if (this.signer) return Promise.resolve(this.signer);
    return new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error("Sign in with your email first")), ms);
      this.waiters.push((s) => {
        clearTimeout(t);
        if (s) resolve(s);
        else reject(new Error("Signed out"));
      });
    });
  }

  private info(s: PrivySigner) {
    return new AccountInfo({ address: AccountAddress.from(s.address), publicKey: new Ed25519PublicKey(s.publicKey) });
  }

  get accounts(): AptosWalletAccount[] {
    if (!this.signer) return [];
    return [
      {
        address: AccountAddress.from(this.signer.address).toString(),
        publicKey: new Ed25519PublicKey(this.signer.publicKey).toUint8Array(),
        chains: this.chains,
        features: [],
        signingScheme: SigningScheme.Ed25519,
      },
    ];
  }

  private async authenticator(tx: AnyRawTransaction) {
    const s = await this.waitForSigner();
    const message = generateSigningMessageForTransaction(tx);
    const sig = await s.signRawHash(Hex.fromHexInput(message).toString() as `0x${string}`);
    return new AccountAuthenticatorEd25519(new Ed25519PublicKey(s.publicKey), new Ed25519Signature(sig));
  }

  readonly features: AptosWallet["features"] = {
    "aptos:connect": {
      version: "1.0.0",
      connect: async () => approved(this.info(await this.waitForSigner())),
    },
    "aptos:disconnect": { version: "1.0.0", disconnect: async () => undefined },
    "aptos:account": { version: "1.0.0", account: async () => this.info(await this.waitForSigner()) },
    "aptos:network": { version: "1.0.0", network: async () => NETWORK },
    "aptos:onAccountChange": {
      version: "1.0.0",
      onAccountChange: async (cb) => {
        this.accountListeners.push(cb);
      },
    },
    "aptos:onNetworkChange": { version: "1.0.0", onNetworkChange: async () => undefined },
    "aptos:signMessage": {
      version: "1.0.0",
      signMessage: async (input: AptosSignMessageInput) => {
        const s = await this.waitForSigner();
        const address = AccountAddress.from(s.address).toString();
        let fullMessage = "APTOS";
        if (input.address) fullMessage += `\naddress: ${address}`;
        if (input.application) fullMessage += `\napplication: ${window.location.origin}`;
        if (input.chainId) fullMessage += `\nchainId: ${NETWORK.chainId}`;
        fullMessage += `\nmessage: ${input.message}\nnonce: ${input.nonce}`;
        const sig = await s.signRawHash(Hex.fromHexInput(new TextEncoder().encode(fullMessage)).toString() as `0x${string}`);
        return approved({
          address: input.address ? address : undefined,
          application: input.application ? window.location.origin : undefined,
          chainId: input.chainId ? NETWORK.chainId : undefined,
          fullMessage,
          message: input.message,
          nonce: input.nonce,
          prefix: "APTOS" as const,
          signature: new Ed25519Signature(sig),
        });
      },
    },
    "aptos:signTransaction": {
      version: "1.0.0",
      signTransaction: async (tx: AnyRawTransaction) => approved(await this.authenticator(tx)),
    },
    "aptos:signAndSubmitTransaction": {
      version: "1.1.0",
      signAndSubmitTransaction: async (input: AptosSignAndSubmitTransactionInput) => {
        const s = await this.waitForSigner();
        // Forge is the fee payer: email accounts never need APT for gas.
        const tx = await getAptosBrowserClient().transaction.build.simple({
          sender: s.address,
          data: input.payload,
          withFeePayer: true,
          options: { maxGasAmount: input.maxGasAmount, gasUnitPrice: input.gasUnitPrice },
        });
        const auth = await this.authenticator(tx);
        const res = await fetch("/api/sponsor/gas", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ transaction: tx.bcsToHex().toString(), senderAuthenticator: auth.bcsToHex().toString() }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || "Could not submit the transaction");
        return approved({ hash: data.hash as `0x${string}` });
      },
    },
  };
}

let instance: ForgeAccountWallet | null = null;

/** The single wallet instance, registered with the wallet standard on first use. */
export function forgeAccountWallet() {
  if (!instance) {
    instance = new ForgeAccountWallet();
    void import("@aptos-labs/wallet-standard").then(({ registerWallet }) => registerWallet(instance!));
  }
  return instance;
}
