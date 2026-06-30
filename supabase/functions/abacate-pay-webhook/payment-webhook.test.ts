import { assertEquals, assertRejects } from "jsr:@std/assert";
import type { SupabaseClient } from "@supabase";
import {
  type AbacatePayWebhookPayload,
  mapAbacatePayWebhookPayload,
  type Payment,
  type PaymentProviderEvent,
  processWebhook,
} from "../_shared/payment-webhook.ts";

const supabase = {} as SupabaseClient;

function createPayment(overrides: Partial<Payment> = {}): Payment {
  return {
    id: "payment-1",
    subscription_id: "subscription-1",
    user_id: "user-1",
    organization_id: "organization-1",
    amount: 10000,
    status: "pending",
    ...overrides,
  };
}

function createPayload(
  overrides: {
    event?: string;
    amount?: number;
    paidAmount?: number;
    transparentId?: string;
    status?: string;
  } = {},
): AbacatePayWebhookPayload {
  return {
    id: "webhook-1",
    event: overrides.event ?? "transparent.completed",
    apiVersion: 2,
    devMode: false,
    data: {
      transparent: {
        id: overrides.transparentId ?? "charge-1",
        externalId: "payment-1",
        amount: overrides.amount ?? 10000,
        paidAmount: overrides.paidAmount ?? 10000,
        status: overrides.status ?? "PAID",
      },
    },
  };
}

function createProviderEvent(
  overrides: {
    isPaid?: boolean;
    paymentAmount?: number;
    chargeAmount?: number;
    providerPaymentId?: string;
    rawEvent?: string;
  } = {},
): PaymentProviderEvent {
  return {
    provider: "abacate_pay",
    providerPaymentId: overrides.providerPaymentId ?? "charge-1",
    paymentAmount: overrides.paymentAmount ?? 10000,
    chargeAmount: overrides.chargeAmount ?? 10000,
    isPaid: overrides.isPaid ?? true,
    rawEvent: overrides.rawEvent ?? "transparent.completed",
  };
}

Deno.test("maps Abacate Pay webhook payload to a provider payment event", () => {
  assertEquals(mapAbacatePayWebhookPayload(createPayload()), {
    provider: "abacate_pay",
    providerPaymentId: "charge-1",
    paymentAmount: 10000,
    chargeAmount: 10000,
    isPaid: true,
    rawEvent: "transparent.completed",
  });
});

Deno.test("maps non-paid transparent payloads as unpaid events", () => {
  assertEquals(
    mapAbacatePayWebhookPayload(
      createPayload({ event: "transparent.refunded" }),
    ),
    {
      provider: "abacate_pay",
      providerPaymentId: "charge-1",
      paymentAmount: 10000,
      chargeAmount: 10000,
      isPaid: false,
      rawEvent: "transparent.refunded",
    },
  );
});

Deno.test("rejects legacy Pix QR code webhook payloads", async () => {
  await assertRejects(
    async () => {
      mapAbacatePayWebhookPayload({
        id: "webhook-1",
        event: "billing.paid",
        devMode: false,
        data: {
          payment: {
            amount: 10000,
            fee: 0,
            method: "pix",
          },
          pixQrCode: {
            id: "legacy-charge-1",
            amount: 10000,
            kind: "pix",
            status: "paid",
          },
        },
      });
    },
    Error,
    "Unsupported Abacate Pay webhook payload.",
  );
});

Deno.test("paid webhook with matching provider amount marks payment succeeded once", async () => {
  const calls: string[] = [];
  const payment = createPayment();

  const result = await processWebhook(supabase, createProviderEvent(), {
    fetchPayment: async () => payment,
    markPaymentSucceededIfPending: async (_supabase, paymentId) => {
      calls.push(`succeeded:${paymentId}`);
      return true;
    },
  });

  assertEquals(result, { processed: true });
  assertEquals(calls, ["succeeded:payment-1"]);
});

Deno.test("paid webhook with lower provider payment amount does not activate", async () => {
  const calls: string[] = [];

  const result = await processWebhook(
    supabase,
    createProviderEvent({ paymentAmount: 100 }),
    {
      fetchPayment: async () => createPayment(),
      markPaymentFailedIfPending: async (_supabase, paymentId) => {
        calls.push(`failed:${paymentId}`);
        return true;
      },
      markPaymentSucceededIfPending: async () => {
        throw new Error("Payment should not be marked succeeded.");
      },
    },
  );

  assertEquals(result, {
    processed: true,
    message: "Payment amount mismatch.",
  });
  assertEquals(calls, ["failed:payment-1"]);
});

Deno.test("paid webhook with mismatched Pix QR code amount does not activate", async () => {
  const calls: string[] = [];

  const result = await processWebhook(
    supabase,
    createProviderEvent({ chargeAmount: 9000 }),
    {
      fetchPayment: async () => createPayment(),
      markPaymentFailedIfPending: async (_supabase, paymentId) => {
        calls.push(`failed:${paymentId}`);
        return true;
      },
      markPaymentSucceededIfPending: async () => {
        throw new Error("Payment should not be marked succeeded.");
      },
    },
  );

  assertEquals(result, {
    processed: true,
    message: "Payment amount mismatch.",
  });
  assertEquals(calls, ["failed:payment-1"]);
});

Deno.test("duplicate paid webhook for succeeded payment does not activate again", async () => {
  const result = await processWebhook(supabase, createProviderEvent(), {
    fetchPayment: async () => createPayment({ status: "succeeded" }),
    markPaymentSucceededIfPending: async () => {
      throw new Error("Already succeeded payment should not be updated.");
    },
  });

  assertEquals(result, {
    processed: true,
    message: "Payment already succeeded.",
  });
});

Deno.test("non-paid events mark pending payments failed without activating", async () => {
  const calls: string[] = [];

  const result = await processWebhook(
    supabase,
    createProviderEvent({ isPaid: false, rawEvent: "transparent.refunded" }),
    {
      fetchPayment: async () => createPayment(),
      markPaymentFailedIfPending: async (_supabase, paymentId) => {
        calls.push(`failed:${paymentId}`);
        return true;
      },
    },
  );

  assertEquals(result, { processed: true });
  assertEquals(calls, ["failed:payment-1"]);
});

Deno.test("unknown charge IDs are acknowledged without throwing", async () => {
  const result = await processWebhook(supabase, createProviderEvent(), {
    fetchPayment: async () => null,
  });

  assertEquals(result, {
    processed: false,
    message: "Payment not found, but acknowledged.",
  });
});
