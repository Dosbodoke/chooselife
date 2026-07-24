import { corsHeaders } from "../_shared/cors.ts";
import type {
  CreatePaymentCheckoutPayload,
  PaymentCheckoutSession,
} from "../_shared/edge-functions.types.ts";
import { supabaseAdmin } from "../_shared/supabase-admin.ts";
import { createSupabaseClient } from "../_shared/supabase-client.ts";
import {
  createCheckoutForPayment,
  InvalidPaymentStateError,
  PaymentNotFoundError,
  PaymentOwnerMismatchError,
} from "../_shared/stripe-checkout.ts";

function jsonResponse(
  body: unknown,
  status: number,
): Response {
  return new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status,
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authorization = req.headers.get("Authorization");
    if (!authorization) {
      return jsonResponse({ error: "Authorization header is required." }, 401);
    }

    const supabase = createSupabaseClient(authorization);
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return jsonResponse({ error: "User not authenticated." }, 401);
    }

    const { paymentId }: CreatePaymentCheckoutPayload = await req.json();
    if (paymentId === undefined) {
      throw new Error("paymentId is required.");
    }

    const checkoutData = await createCheckoutForPayment({
      supabaseAdmin,
      paymentId,
      expectedUserId: user.id,
      customerEmail: user.email,
    });

    return new Response(
      JSON.stringify(checkoutData satisfies PaymentCheckoutSession),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      },
    );
  } catch (error: unknown) {
    console.error(error);
    if (error instanceof PaymentOwnerMismatchError) {
      return jsonResponse({ error: error.message }, 403);
    }
    if (
      error instanceof PaymentNotFoundError ||
      error instanceof InvalidPaymentStateError
    ) {
      return jsonResponse({ error: error.message }, 400);
    }

    return jsonResponse({
      error: error instanceof Error ? error.message : "An unknown error occurred.",
    }, 400);
  }
});
