import { corsHeaders } from "../_shared/cors.ts";
import type {
  CreatePaymentCheckoutPayload,
  PaymentCheckoutSession,
} from "../_shared/edge-functions.types.ts";
import { supabaseAdmin } from "../_shared/supabase-admin.ts";
import { createSupabaseClient } from "../_shared/supabase-client.ts";
import {
  createChargeForPayment,
  InvalidPaymentStateError,
  PaymentNotFoundError,
  PaymentOwnerMismatchError,
} from "../_shared/abacate-pay-charge.ts";

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

    const { paymentId, customer }: CreatePaymentCheckoutPayload = await req
      .json();
    if (paymentId === undefined) {
      throw new Error("paymentId is required.");
    }
    if (
      customer !== undefined && (
        customer.name === undefined ||
        customer.email === undefined ||
        customer.cellphone === undefined ||
        customer.taxId === undefined
      )
    ) {
      throw new Error(
        "customer info should contain name, email, cellphone and taxId.",
      );
    }

    const chargeData = await createChargeForPayment({
      supabaseAdmin,
      paymentId,
      expectedUserId: user.id,
      customer,
    });

    return new Response(
      JSON.stringify(
        {
          ...chargeData,
        } satisfies PaymentCheckoutSession,
      ),
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

    let errorMessage = "An unknown error occurred.";
    if (error instanceof Error) {
      errorMessage = error.message;
    }
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
