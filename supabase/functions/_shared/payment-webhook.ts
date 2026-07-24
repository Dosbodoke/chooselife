import type { SupabaseClient } from "@supabase";
import type { Tables } from "./database.types.ts";

type PaymentStatus = Tables<"payments">["status"];

export interface AbacatePayWebhookPayload {
  id: string;
  event: string;
  apiVersion?: number;
  devMode: boolean;
  data: {
    transparent?: {
      id: string;
      amount: number;
      paidAmount?: number;
      status: string;
      externalId?: string;
    };
    payment?: {
      amount: number;
      fee: number;
      method: string;
    };
    pixQrCode?: {
      id: string;
      amount: number;
      kind: string;
      status: string;
    };
  };
}

export interface StripeCheckoutSession {
  id: string;
  object: "checkout.session";
  amount_total: number | null;
  payment_status: string;
  status?: string | null;
}

export interface StripeWebhookPayload {
  id: string;
  type: string;
  data: {
    object: StripeCheckoutSession;
  };
}

export type PaymentProviderEvent = {
  provider: "abacate_pay" | "stripe";
  providerPaymentId: string;
  paymentAmount: number;
  chargeAmount: number;
  isPaid: boolean;
  rawEvent: string;
};

export type Payment = Pick<
  Tables<"payments">,
  | "id"
  | "subscription_id"
  | "user_id"
  | "organization_id"
  | "amount"
  | "status"
>;

type ProcessWebhookDependencies = {
  fetchPayment?: typeof fetchPayment;
  markPaymentSucceededIfPending?: typeof markPaymentSucceededIfPending;
  markPaymentFailedIfPending?: typeof markPaymentFailedIfPending;
};

export async function fetchPayment(
  supabase: SupabaseClient,
  event: Pick<PaymentProviderEvent, "provider" | "providerPaymentId">,
): Promise<Payment | null> {
  const { data, error } = await supabase
    .from("payments")
    .select("id, subscription_id, user_id, organization_id, amount, status")
    .eq("payment_provider", event.provider)
    .eq("provider_payment_id", event.providerPaymentId)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      console.warn(
        `Payment not found for ${event.provider}:${event.providerPaymentId}`,
      );
      return null;
    }
    throw error;
  }

  return data;
}

export async function markPaymentSucceededIfPending(
  supabase: SupabaseClient,
  paymentId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("payments")
    .update({ status: "succeeded", paid_at: new Date().toISOString() })
    .eq("id", paymentId)
    .eq("status", "pending")
    .select("id");

  if (error) throw error;
  return (data ?? []).length === 1;
}

export async function markPaymentFailedIfPending(
  supabase: SupabaseClient,
  paymentId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("payments")
    .update({ status: "failed", paid_at: null })
    .eq("id", paymentId)
    .eq("status", "pending")
    .select("id");

  if (error) throw error;
  return (data ?? []).length === 1;
}

export function mapAbacatePayWebhookPayload(
  payload: AbacatePayWebhookPayload,
): PaymentProviderEvent {
  if (payload.data.transparent) {
    const transparent = payload.data.transparent;

    return {
      provider: "abacate_pay",
      providerPaymentId: transparent.id,
      paymentAmount: transparent.paidAmount ?? transparent.amount,
      chargeAmount: transparent.amount,
      isPaid: payload.event === "transparent.completed" &&
        transparent.status === "PAID",
      rawEvent: payload.event,
    };
  }

  throw new Error("Unsupported Abacate Pay webhook payload.");
}

export function mapStripeWebhookPayload(
  payload: StripeWebhookPayload,
): PaymentProviderEvent {
  const checkoutSession = payload.data.object;

  if (checkoutSession.object !== "checkout.session") {
    throw new Error("Unsupported Stripe webhook payload.");
  }

  if (checkoutSession.amount_total == null) {
    throw new Error("Stripe Checkout Session is missing amount_total.");
  }

  const isPaid = payload.type === "checkout.session.completed" &&
    checkoutSession.payment_status === "paid";

  return {
    provider: "stripe",
    providerPaymentId: checkoutSession.id,
    paymentAmount: checkoutSession.amount_total,
    chargeAmount: checkoutSession.amount_total,
    isPaid,
    rawEvent: payload.type,
  };
}

function parseStripeSignatureHeader(header: string): {
  timestamp: string | null;
  signatures: string[];
} {
  const parts = header.split(",");
  const signatures: string[] = [];
  let timestamp: string | null = null;

  for (const part of parts) {
    const [key, value] = part.split("=", 2);
    if (key === "t") {
      timestamp = value;
    } else if (key === "v1" && value) {
      signatures.push(value);
    }
  }

  return { timestamp, signatures };
}

function bytesToHex(bytes: ArrayBuffer): string {
  return Array.from(new Uint8Array(bytes))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function timingSafeEqual(a: string, b: string): boolean {
  const aBytes = new TextEncoder().encode(a);
  const bBytes = new TextEncoder().encode(b);
  if (aBytes.length !== bBytes.length) return false;

  let diff = 0;
  for (let i = 0; i < aBytes.length; i += 1) {
    diff |= aBytes[i] ^ bBytes[i];
  }
  return diff === 0;
}

export async function verifyStripeSignature(
  rawBody: string,
  signatureHeader: string,
  endpointSecret: string,
  toleranceSeconds = 300,
  nowSeconds = Math.floor(Date.now() / 1000),
): Promise<boolean> {
  const { timestamp, signatures } = parseStripeSignatureHeader(
    signatureHeader,
  );
  if (!timestamp || signatures.length === 0) return false;

  const timestampNumber = Number(timestamp);
  if (!Number.isFinite(timestampNumber)) return false;
  if (Math.abs(nowSeconds - timestampNumber) > toleranceSeconds) return false;

  const signedPayload = `${timestamp}.${rawBody}`;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(endpointSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(signedPayload),
  );
  const expectedSignature = bytesToHex(signature);

  return signatures.some((candidate) =>
    timingSafeEqual(candidate, expectedSignature)
  );
}

function providerAmountMatchesPayment(
  event: PaymentProviderEvent,
  payment: Payment,
): boolean {
  return event.paymentAmount === payment.amount &&
    event.chargeAmount === payment.amount;
}

/**
 * Main webhook processing logic.
 */
export async function processWebhook(
  supabase: SupabaseClient,
  event: PaymentProviderEvent,
  dependencies: ProcessWebhookDependencies = {},
): Promise<{ processed: boolean; message?: string }> {
  console.log("Processing payment provider event:", event);

  const fetchPaymentFn = dependencies.fetchPayment ?? fetchPayment;
  const markSucceededFn = dependencies.markPaymentSucceededIfPending ??
    markPaymentSucceededIfPending;
  const markFailedFn = dependencies.markPaymentFailedIfPending ??
    markPaymentFailedIfPending;

  const payment = await fetchPaymentFn(supabase, event);
  if (!payment) {
    return {
      processed: false,
      message: "Payment not found, but acknowledged.",
    };
  }

  if (payment.status === "succeeded") {
    return { processed: true, message: "Payment already succeeded." };
  }

  if (payment.status === "failed") {
    return { processed: true, message: "Payment already failed." };
  }

  if (!event.isPaid) {
    await markFailedFn(supabase, payment.id);
    return { processed: true };
  }

  if (!providerAmountMatchesPayment(event, payment)) {
    await markFailedFn(supabase, payment.id);
    return {
      processed: true,
      message: "Payment amount mismatch.",
    };
  }

  const didMarkSucceeded = await markSucceededFn(supabase, payment.id);
  if (!didMarkSucceeded) {
    return {
      processed: true,
      message: "Payment was already settled.",
    };
  }

  return { processed: true };
}
