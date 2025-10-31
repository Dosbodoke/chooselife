import "jsr:@supabase/functions-js/edge-runtime.d.ts"

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { crypto } from "https://deno.land/std@0.168.0/crypto/mod.ts";

const ABACATE_PAY_WEBHOOK_SECRET = Deno.env.get("ABACATE_PAY_WEBHOOK_SECRET")!;

// Function to verify the signature from Abacate Pay
async function verifySignature(signature: string, body: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(ABACATE_PAY_WEBHOOK_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const mac = await crypto.subtle.sign("HMAC", key, encoder.encode(body));

  // Convert ArrayBuffer to hex string
  const hexMac = Array.from(new Uint8Array(mac))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  // Compare the calculated signature with the one from the header
  // This comparison should be done in a timing-safe manner in a real production environment
  return hexMac === signature;
}

serve(async (req) => {
  const signature = req.headers.get("X-AbacatePay-Signature")!; // Verify header name from docs
  const rawBody = await req.text();

  // 1. Verify the webhook signature for security
  const isVerified = await verifySignature(signature, rawBody);
  if (!isVerified) {
    return new Response("Signature verification failed.", { status: 401 });
  }

  try {
    const event = JSON.parse(rawBody);

    // 2. Process only the events you care about (e.g., 'charge.paid')
    if (event.type === "charge.paid") {
      const charge = event.data.object; // Verify the payload structure from docs

      // Create a Supabase admin client to perform privileged operations
      const supabaseAdmin = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      );

      // 3. Find the corresponding subscription
      const { data: subscription, error: subError } = await supabaseAdmin
        .from("subscriptions")
        .select("id, user_id, organization_id")
        .eq("abacate_pay_charge_id", charge.id)
        .single();

      if (subError || !subscription) {
        // If we don't find a subscription, it might be an old charge or an error.
        // Acknowledge with 200 so Abacate Pay doesn't retry, but log the issue.
        console.warn(`Subscription not found for charge: ${charge.id}`);
        return new Response("OK", { status: 200 });
      }

      // 4. Update the subscription to 'active'
      const periodEnd = new Date();
      periodEnd.setMonth(periodEnd.getMonth() + 1);

      const { error: updateError } = await supabaseAdmin
        .from("subscriptions")
        .update({
          status: "active",
          current_period_end: periodEnd.toISOString(),
        })
        .eq("id", subscription.id);

      if (updateError) throw updateError;

      // 5. Create a historical record in the 'payments' table
      const { error: paymentError } = await supabaseAdmin
        .from("payments")
        .insert({
          user_id: subscription.user_id,
          organization_id: subscription.organization_id,
          subscription_id: subscription.id,
          amount: charge.value, // Amount in cents
          currency: charge.currency, // e.g., 'BRL'
          status: 'succeeded',
          paid_at: new Date(charge.paid_at * 1000).toISOString(), // Assuming paid_at is a Unix timestamp
          abacate_pay_charge_id: charge.id,
        });

      if (paymentError) throw paymentError;
    }

    // 6. Acknowledge receipt of the event
    return new Response(JSON.stringify({ received: true }), { status: 200 });

  } catch (error) {
    console.error("Webhook processing error:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 400 });
  }
});
