import {
  assertEquals,
} from "jsr:@std/assert";
import type { SupabaseClient } from "@supabase";
import {
  processWebhook,
  type Payment,
  type WebhookPayload,
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
    paymentAmount?: number;
    pixQrCodeAmount?: number;
    pixQrCodeId?: string;
  } = {},
): WebhookPayload {
  return {
    id: "webhook-1",
    event: overrides.event ?? "billing.paid",
    devMode: false,
    data: {
      payment: {
        amount: overrides.paymentAmount ?? 10000,
        fee: 0,
        method: "pix",
      },
      pixQrCode: {
        id: overrides.pixQrCodeId ?? "charge-1",
        amount: overrides.pixQrCodeAmount ?? 10000,
        kind: "pix",
        status: "paid",
      },
    },
  };
}

Deno.test("paid webhook with matching provider amount settles once", async () => {
  const calls: string[] = [];
  const payment = createPayment();

  const result = await processWebhook(supabase, createPayload(), {
    fetchPayment: async () => payment,
    markPaymentSucceededIfPending: async (_supabase, paymentId) => {
      calls.push(`succeeded:${paymentId}`);
      return true;
    },
    processSuccessfulPayment: async (_supabase, settledPayment) => {
      calls.push(`activated:${settledPayment.id}`);
    },
  });

  assertEquals(result, { processed: true });
  assertEquals(calls, ["succeeded:payment-1", "activated:payment-1"]);
});

Deno.test("paid webhook with lower provider payment amount does not activate", async () => {
  const calls: string[] = [];

  const result = await processWebhook(
    supabase,
    createPayload({ paymentAmount: 100 }),
    {
      fetchPayment: async () => createPayment(),
      markPaymentFailedIfPending: async (_supabase, paymentId) => {
        calls.push(`failed:${paymentId}`);
        return true;
      },
      markPaymentSucceededIfPending: async () => {
        throw new Error("Payment should not be marked succeeded.");
      },
      processSuccessfulPayment: async () => {
        throw new Error("Payment should not activate.");
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
    createPayload({ pixQrCodeAmount: 9000 }),
    {
      fetchPayment: async () => createPayment(),
      markPaymentFailedIfPending: async (_supabase, paymentId) => {
        calls.push(`failed:${paymentId}`);
        return true;
      },
      markPaymentSucceededIfPending: async () => {
        throw new Error("Payment should not be marked succeeded.");
      },
      processSuccessfulPayment: async () => {
        throw new Error("Payment should not activate.");
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
  const result = await processWebhook(supabase, createPayload(), {
    fetchPayment: async () => createPayment({ status: "succeeded" }),
    markPaymentSucceededIfPending: async () => {
      throw new Error("Already succeeded payment should not be updated.");
    },
    processSuccessfulPayment: async () => {
      throw new Error("Already succeeded payment should not activate.");
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
    createPayload({ event: "billing.expired" }),
    {
      fetchPayment: async () => createPayment(),
      markPaymentFailedIfPending: async (_supabase, paymentId) => {
        calls.push(`failed:${paymentId}`);
        return true;
      },
      processSuccessfulPayment: async () => {
        throw new Error("Failed payment should not activate.");
      },
    },
  );

  assertEquals(result, { processed: true });
  assertEquals(calls, ["failed:payment-1"]);
});

Deno.test("unknown charge IDs are acknowledged without throwing", async () => {
  const result = await processWebhook(supabase, createPayload(), {
    fetchPayment: async () => null,
  });

  assertEquals(result, {
    processed: false,
    message: "Payment not found, but acknowledged.",
  });
});
