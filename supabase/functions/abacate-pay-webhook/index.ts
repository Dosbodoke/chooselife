import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import crypto from "node:crypto";
import { Buffer } from "node:buffer";

const ABACATE_PAY_WEBHOOK_SECRET = Deno.env.get("ABACATE_PAY_WEBHOOK_SECRET")!;
// Public HMAC key
const ABACATEPAY_PUBLIC_KEY =
  "t9dXRhHHo3yDEj5pVDYz0frf7q6bMKyMRmxxCPIPp3RCplBfXRxqlC6ZpiWmOqj4L63qEaeUOtrCI8P0VMUgo6iIga2ri9ogaHFs0WIIywSMg0q7RmBfybe1E5XJcfC4IW3alNqym0tXoAKkzvfEjZxV6bE0oG2zJrNNYmUCKZyV0KZ3JS8Votf9EAWWYdiDkMkpbMdPggfh1EqHlVkMiTady6jOR3hyzGEHrIz2Ret0xHKMbiqkr9HS1JhNHDX9";

/**
 * Verifies if the webhook signature matches the expected HMAC.
 * @param rawBody Raw request body string.
 * @param signatureFromHeader The signature received from `X-Webhook-Signature`.
 * @returns true if the signature is valid, false otherwise.
 */
export function verifyAbacateSignature(
  rawBody: string,
  signatureFromHeader: string,
) {
  const bodyBuffer = Buffer.from(rawBody, "utf8");

  const expectedSig = crypto
    .createHmac("sha256", ABACATEPAY_PUBLIC_KEY)
    .update(bodyBuffer)
    .digest("base64");

  const A = Buffer.from(expectedSig);
  const B = Buffer.from(signatureFromHeader);

  return A.length === B.length && crypto.timingSafeEqual(A, B);
}

Deno.serve(async (req) => {
  // 1. Verify the webhook secret from the query parameter (optional, but good for an extra layer)
  const url = new URL(req.url);
  const webhookSecret = url.searchParams.get("webhookSecret");

  if (webhookSecret !== ABACATE_PAY_WEBHOOK_SECRET) {
    return new Response("Invalid webhook secret.", { status: 401 });
  }

  const signature = req.headers.get("X-Webhook-Signature")!;
  const rawBody = await req.text();

  // 2. Verify the webhook signature
  const isVerified = verifyAbacateSignature(rawBody, signature);
  if (!isVerified) {
    return new Response("Signature verification failed.", { status: 401 });
  }

  try {
    const payload = JSON.parse(rawBody);
    console.log("Processing webhook event:", payload);

    const abacatePayChargeId = payload.data.pixQrCode?.id || payload.data.charge?.id;
    if (!abacatePayChargeId) {
      return new Response("Charge ID not found in webhook payload.", { status: 400 });
    }

    // 3. Determine the internal status based on the event type
    let paymentStatus: 'succeeded' | 'failed' | null = null;
    switch (payload.event) {
      case "billing.paid":
        paymentStatus = "succeeded";
        break;
      case "billing.failed":
      case "billing.expired": // Assuming expired is also a failure for the payment
        paymentStatus = "failed";
        break;
      default:
        // Acknowledge other events without processing
        return new Response(
          JSON.stringify({
            received: true,
            processed: false,
            message: "Event type not handled.",
          }),
          { status: 200 },
        );
    }

    // Create a Supabase admin client
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // 4. Find the payment record using the charge ID
    const { data: payment, error: paymentFetchError } = await supabaseAdmin
      .from("payments")
      .select("id, subscription_id, user_id, organization_id")
      .eq("abacate_pay_charge_id", abacatePayChargeId)
      .single();

    if (paymentFetchError) {
      // If the payment is not found, we acknowledge with 200 to prevent retries.
      if (paymentFetchError.code === "PGRST116") {
        console.warn(
          `Payment not found for abacate_pay_charge_id: ${abacatePayChargeId}`,
        );
        return new Response("Payment not found, but acknowledged.", {
          status: 200,
        });
      }
      console.error("Error fetching payment:", paymentFetchError);
      throw paymentFetchError;
    }

    // 5. Update the 'payments' table to notify the listening client
    const { error: paymentUpdateError } = await supabaseAdmin
      .from("payments")
      .update({
        status: paymentStatus,
        paid_at: paymentStatus === 'succeeded' ? new Date().toISOString() : null,
      })
      .eq("id", payment.id);

    if (paymentUpdateError) {
      console.error("Error updating payment:", paymentUpdateError);
      throw paymentUpdateError;
    }

    // 6. If payment was successful, activate the subscription
    if (paymentStatus === "succeeded" && payment.subscription_id) {
      const periodEnd = new Date();
      // Assuming monthly plan for now, as per original logic
      periodEnd.setMonth(periodEnd.getMonth() + 1);

      const { error: subscriptionUpdateError } = await supabaseAdmin
        .from("subscriptions")
        .update({
          status: "active",
          current_period_end: periodEnd.toISOString(),
        })
        .eq("id", payment.subscription_id);

      if (subscriptionUpdateError) {
        // Log error but don't fail the webhook, as payment is processed.
        // This might need manual intervention.
        console.error("Error activating subscription:", subscriptionUpdateError);
      }

      // Add user to the organization
      const { error: memberInsertError } = await supabaseAdmin
        .from("organization_members")
        .upsert({
          organization_id: payment.organization_id,
          user_id: payment.user_id,
          role: "member",
        });

      if (memberInsertError) {
        console.error("Error inserting into organization_members:", memberInsertError);
      }
    }

    // 7. Acknowledge receipt of the event
    return new Response(JSON.stringify({ received: true, processed: true }), {
      status: 200,
    });
  } catch (error) {
    console.error("Webhook processing error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
    });
  }
});
