import type { SupabaseClient } from "@supabase";
import type { Tables } from "./database.types.ts";

type PaymentStatus = Tables<"payments">["status"];

export interface WebhookPayload {
  id: string;
  event: string;
  devMode: boolean;
  data: {
    payment: {
      amount: number;
      fee: number;
      method: string;
    };
    pixQrCode: {
      id: string;
      amount: number;
      kind: string;
      status: string;
    };
  };
}

export type Payment = Pick<
  Tables<"payments">,
  | "id"
  | "subscription_id"
  | "user_id"
  | "organization_id"
  | "amount"
  | "status"
>;

interface Subscription {
  current_period_end: string;
}

type ProcessWebhookDependencies = {
  fetchPayment?: typeof fetchPayment;
  markPaymentSucceededIfPending?: typeof markPaymentSucceededIfPending;
  markPaymentFailedIfPending?: typeof markPaymentFailedIfPending;
  processSuccessfulPayment?: typeof processSuccessfulPayment;
};

/**
 * Fetches payment record by charge ID.
 */
export async function fetchPayment(
  supabase: SupabaseClient,
  chargeId: string,
): Promise<Payment | null> {
  const { data, error } = await supabase
    .from("payments")
    .select("id, subscription_id, user_id, organization_id, amount, status")
    .eq("abacate_pay_charge_id", chargeId)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      console.warn(`Payment not found for abacate_pay_charge_id: ${chargeId}`);
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

/**
 * Calculates the new subscription period end date.
 */
export function calculateNewPeriodEnd(currentPeriodEnd: string): Date {
  const now = new Date();
  const currentEnd = new Date(currentPeriodEnd);
  const startDate = currentEnd > now ? currentEnd : now;

  startDate.setMonth(startDate.getMonth() + 1);
  return startDate;
}

/**
 * Fetches subscription by ID.
 */
export async function fetchSubscription(
  supabase: SupabaseClient,
  subscriptionId: string,
): Promise<Subscription | null> {
  const { data, error } = await supabase
    .from("subscriptions")
    .select("current_period_end")
    .eq("id", subscriptionId)
    .single();

  if (error) {
    console.error(
      `Failed to fetch subscription ${subscriptionId}:`,
      error,
    );
    return null;
  }

  return data;
}

/**
 * Activates subscription and extends the period.
 */
export async function activateSubscription(
  supabase: SupabaseClient,
  subscriptionId: string,
): Promise<void> {
  const subscription = await fetchSubscription(supabase, subscriptionId);

  if (!subscription) {
    console.error(
      `Cannot activate subscription ${subscriptionId}. Manual intervention may be required.`,
    );
    return;
  }

  const newPeriodEnd = calculateNewPeriodEnd(subscription.current_period_end);

  const { error } = await supabase
    .from("subscriptions")
    .update({
      status: "active",
      current_period_end: newPeriodEnd.toISOString(),
    })
    .eq("id", subscriptionId);

  if (error) {
    console.error("Error activating subscription:", error);
  }
}

/**
 * Adds user to organization as a member.
 */
export async function addUserToOrganization(
  supabase: SupabaseClient,
  organizationId: string,
  userId: string,
): Promise<void> {
  const { error } = await supabase
    .from("organization_members")
    .upsert({
      organization_id: organizationId,
      user_id: userId,
      role: "member",
    });

  if (error) {
    console.error("Error inserting into organization_members:", error);
  }
}

/**
 * Processes successful payment by activating subscription and adding user to org.
 */
export async function processSuccessfulPayment(
  supabase: SupabaseClient,
  payment: Payment,
): Promise<void> {
  if (payment.subscription_id) {
    await activateSubscription(supabase, payment.subscription_id);
  }

  await addUserToOrganization(
    supabase,
    payment.organization_id,
    payment.user_id,
  );
}

function providerAmountMatchesPayment(
  payload: WebhookPayload,
  payment: Payment,
): boolean {
  return payload.data.payment.amount === payment.amount &&
    payload.data.pixQrCode.amount === payment.amount;
}

/**
 * Main webhook processing logic.
 */
export async function processWebhook(
  supabase: SupabaseClient,
  payload: WebhookPayload,
  dependencies: ProcessWebhookDependencies = {},
): Promise<{ processed: boolean; message?: string }> {
  console.log("Processing webhook event:", payload);

  const fetchPaymentFn = dependencies.fetchPayment ?? fetchPayment;
  const markSucceededFn = dependencies.markPaymentSucceededIfPending ??
    markPaymentSucceededIfPending;
  const markFailedFn = dependencies.markPaymentFailedIfPending ??
    markPaymentFailedIfPending;
  const processSuccessfulPaymentFn = dependencies.processSuccessfulPayment ??
    processSuccessfulPayment;

  const pixQrCodeId = payload.data.pixQrCode.id;
  const payment = await fetchPaymentFn(supabase, pixQrCodeId);
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

  if (payload.event !== "billing.paid") {
    await markFailedFn(supabase, payment.id);
    return { processed: true };
  }

  if (!providerAmountMatchesPayment(payload, payment)) {
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

  await processSuccessfulPaymentFn(supabase, payment);

  return { processed: true };
}
