export type ClientPaymentIntent = {
  id: string;
  kind: "ASSET" | "PRODUCT" | "BURNLINK" | "DATASET";
  targetId: string;
  currency: string;
  amountAtomic: string;
  feeAtomic: string;
  netAtomic: string;
  feeBps: number;
  amountApt: number;
  recipient: string;
  productIdentifier: string;
  versionIdentifier: string;
  nonce: string;
  termsHash: string;
  expiresAt: string;
};

export async function requestPaymentIntent(
  kind: ClientPaymentIntent["kind"],
  targetId: string
): Promise<ClientPaymentIntent> {
  const response = await fetch("/api/payment-intents", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ kind, targetId }),
  });
  const data = (await response.json()) as {
    intent?: ClientPaymentIntent;
    error?: string;
  };
  if (!response.ok || !data.intent) {
    throw new Error(data.error || "Unable to create payment intent");
  }
  return data.intent;
}
