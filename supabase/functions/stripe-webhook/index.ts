import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { supabaseAdmin } from "../_shared/supabase-admin.ts";
import {
  mapStripeWebhookPayload,
  processWebhook,
  verifyStripeSignature,
} from "../_shared/payment-webhook.ts";

Deno.serve(async (req) => {
  try {
    const signature = req.headers.get("Stripe-Signature");
    if (!signature) {
      return new Response("Missing Stripe-Signature header.", { status: 401 });
    }

    const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
    if (!webhookSecret) {
      throw new Error("Missing STRIPE_WEBHOOK_SECRET environment variable.");
    }

    const rawBody = await req.text();
    const isVerified = await verifyStripeSignature(
      rawBody,
      signature,
      webhookSecret,
    );
    if (!isVerified) {
      return new Response("Signature verification failed.", { status: 401 });
    }

    const payload = JSON.parse(rawBody);
    const result = await processWebhook(
      supabaseAdmin,
      mapStripeWebhookPayload(payload),
    );

    return new Response(
      JSON.stringify({ received: true, ...result }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  } catch (error: unknown) {
    console.error("Stripe webhook processing error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }
});
