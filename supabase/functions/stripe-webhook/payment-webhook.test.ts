import { assertEquals } from "jsr:@std/assert";
import {
  mapStripeWebhookPayload,
  type StripeWebhookPayload,
  verifyStripeSignature,
} from "../_shared/payment-webhook.ts";

function createStripePayload(
  overrides: Partial<StripeWebhookPayload["data"]["object"]> & {
    type?: string;
  } = {},
): StripeWebhookPayload {
  return {
    id: "evt_1",
    type: overrides.type ?? "checkout.session.completed",
    data: {
      object: {
        id: overrides.id ?? "cs_test_1",
        object: "checkout.session",
        amount_total: overrides.amount_total ?? 3500,
        payment_status: overrides.payment_status ?? "paid",
        status: overrides.status ?? "complete",
      },
    },
  };
}

async function signStripePayload(
  rawBody: string,
  secret: string,
  timestamp: number,
): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`${timestamp}.${rawBody}`),
  );
  const hex = Array.from(new Uint8Array(signature))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  return `t=${timestamp},v1=${hex}`;
}

Deno.test("maps paid Stripe Checkout events to provider payment events", () => {
  assertEquals(mapStripeWebhookPayload(createStripePayload()), {
    provider: "stripe",
    providerPaymentId: "cs_test_1",
    paymentAmount: 3500,
    chargeAmount: 3500,
    isPaid: true,
    rawEvent: "checkout.session.completed",
  });
});

Deno.test("maps unpaid Stripe Checkout events without activating payment", () => {
  assertEquals(
    mapStripeWebhookPayload(
      createStripePayload({
        payment_status: "unpaid",
        status: "expired",
        type: "checkout.session.expired",
      }),
    ),
    {
      provider: "stripe",
      providerPaymentId: "cs_test_1",
      paymentAmount: 3500,
      chargeAmount: 3500,
      isPaid: false,
      rawEvent: "checkout.session.expired",
    },
  );
});

Deno.test("verifies Stripe webhook signatures", async () => {
  const rawBody = JSON.stringify(createStripePayload());
  const secret = "whsec_test_secret";
  const timestamp = 1_787_000_000;
  const header = await signStripePayload(rawBody, secret, timestamp);

  assertEquals(
    await verifyStripeSignature(
      rawBody,
      header,
      secret,
      300,
      timestamp + 10,
    ),
    true,
  );
});

Deno.test("rejects stale Stripe webhook signatures", async () => {
  const rawBody = JSON.stringify(createStripePayload());
  const secret = "whsec_test_secret";
  const timestamp = 1_787_000_000;
  const header = await signStripePayload(rawBody, secret, timestamp);

  assertEquals(
    await verifyStripeSignature(
      rawBody,
      header,
      secret,
      300,
      timestamp + 1_000,
    ),
    false,
  );
});
