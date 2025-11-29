import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import type { SupabaseClient } from "@supabase";
import { Tables } from "../_shared/database.types.ts";

import { supabaseAdmin } from "../_shared/supabase-admin.ts";
import crypto from "node:crypto";
import { Buffer } from "node:buffer";

const ABACATE_PAY_WEBHOOK_SECRET = Deno.env.get("ABACATE_PAY_WEBHOOK_SECRET")!;
const ABACATEPAY_PUBLIC_KEY =
  "t9dXRhHHo3yDEj5pVDYz0frf7q6bMKyMRmxxCPIPp3RCplBfXRxqlC6ZpiWmOqj4L63qEaeUOtrCI8P0VMUgo6iIga2ri9ogaHFs0WIIywSMg0q7RmBfybe1E5XJcfC4IW3alNqym0tXoAKkzvfEjZxV6bE0oG2zJrNNYmUCKZyV0KZ3JS8Votf9EAWWYdiDkMkpbMdPggfh1EqHlVkMiTady6jOR3hyzGEHrIz2Ret0xHKMbiqkr9HS1JhNHDX9";

type PaymentStatus = Tables<"payments">["status"];

interface WebhookPayload {
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

type Payment = Pick<
  Tables<"payments">,
  "id" | "subscription_id" | "user_id" | "organization_id"
>;

interface Subscription {
  current_period_end: string;
}

/**
 * Verifies if the webhook signature matches the expected HMAC.
 */
export function verifyAbacateSignature(
  rawBody: string,
  signatureFromHeader: string,
): boolean {
  const bodyBuffer = Buffer.from(rawBody, "utf8");

  const expectedSig = crypto
    .createHmac("sha256", ABACATEPAY_PUBLIC_KEY)
    .update(bodyBuffer)
    .digest("base64");

  const A = Buffer.from(expectedSig);
  const B = Buffer.from(signatureFromHeader);

  return A.length === B.length && crypto.timingSafeEqual(A, B);
}

/**
 * Validates the webhook secret from query parameters.
 */
export function validateWebhookSecret(url: URL): boolean {
  const webhookSecret = url.searchParams.get("webhookSecret");
  return webhookSecret === ABACATE_PAY_WEBHOOK_SECRET;
}

/**
 * Fetches payment record by charge ID.
 */
export async function fetchPayment(
  supabase: SupabaseClient,
  chargeId: string,
): Promise<Payment | null> {
  const { data, error } = await supabase
    .from("payments")
    .select("id, subscription_id, user_id, organization_id")
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

/**
 * Updates payment record with new status.
 */
export async function updatePaymentStatus(
  supabase: SupabaseClient,
  paymentId: string,
  status: PaymentStatus,
): Promise<void> {
  const { error } = await supabase
    .from("payments")
    .update({
      status: status,
      paid_at: status === "succeeded" ? new Date().toISOString() : null,
    })
    .eq("id", paymentId);

  if (error) {
    console.error("Error updating payment:", error);
    throw error;
  }
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

/**
 * Main webhook processing logic.
 */
export async function processWebhook(
  supabase: SupabaseClient,
  payload: WebhookPayload,
): Promise<{ processed: boolean; message?: string }> {
  console.log("Processing webhook event:", payload);

  const pixQrCodeId = payload.data.pixQrCode.id;
  const paymentStatus: PaymentStatus = payload.event === "billing.paid"
    ? "succeeded"
    : "failed";
  const payment = await fetchPayment(supabase, pixQrCodeId);
  if (!payment) {
    return {
      processed: false,
      message: "Payment not found, but acknowledged.",
    };
  }

  await updatePaymentStatus(supabase, payment.id, paymentStatus);

  if (paymentStatus === "succeeded") {
    await processSuccessfulPayment(supabase, payment);
  }

  return { processed: true };
}

/**
 * Main webhook handler.
 */
Deno.serve(async (req) => {
  try {
    // Validate webhook secret
    const url = new URL(req.url);
    if (!validateWebhookSecret(url)) {
      return new Response("Invalid webhook secret.", { status: 401 });
    }

    // Verify signature
    const signature = req.headers.get("X-Webhook-Signature");
    if (!signature) {
      return new Response("Missing signature header.", { status: 401 });
    }
    const rawBody = await req.text();
    if (!verifyAbacateSignature(rawBody, signature)) {
      return new Response("Signature verification failed.", { status: 401 });
    }

    // Parse and process webhook
    const payload: WebhookPayload = JSON.parse(rawBody);
    const result = await processWebhook(supabaseAdmin, payload);

    return new Response(
      JSON.stringify({ received: true, ...result }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("Webhook processing error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }
});
