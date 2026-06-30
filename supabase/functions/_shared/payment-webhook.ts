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
      paidAmount: number;
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

export type PaymentProviderEvent = {
  provider: "abacate_pay";
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
    return {
      provider: "abacate_pay",
      providerPaymentId: payload.data.transparent.id,
      paymentAmount: payload.data.transparent.paidAmount,
      chargeAmount: payload.data.transparent.amount,
      isPaid: payload.event === "transparent.completed" &&
        payload.data.transparent.status === "PAID",
      rawEvent: payload.event,
    };
  }

  throw new Error("Unsupported Abacate Pay webhook payload.");
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
