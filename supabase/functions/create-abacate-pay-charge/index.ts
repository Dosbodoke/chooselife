import AbacatePay from "abacatepay-nodejs-sdk";
import { corsHeaders } from "../_shared/cors.ts";
import type {
  AbacatePayCharge,
  CreateAbacatePayChargePayload,
} from "../_shared/edge-functions.types.ts";
import { supabaseAdmin } from "../_shared/supabase-admin.ts";

if (!Deno.env.get("ABACATE_PAY_API_KEY")) {
  throw new Error("Missing ABACATE_PAY_API_KEY environment variable.");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { amount, paymentId, customer }: CreateAbacatePayChargePayload =
      await req
        .json();
    if (amount === undefined) {
      throw new Error("amount is required.");
    }
    if (paymentId === undefined) {
      throw new Error("paymentId is required.");
    }
    if (
      customer === undefined || customer.name === undefined ||
      customer.email === undefined
    ) {
      throw new Error("customer name and email are required.");
    }

    const abacatePay = AbacatePay.default(Deno.env.get("ABACATE_PAY_API_KEY")!);
    const pixCode = await abacatePay.pixQrCode.create({
      amount: amount,
      description: "Inscrição para se tornar associado da SL.A.C",
      expiresIn: 3600, // 1 hour
      customer: {
        name: customer.name,
        email: customer.email,
      },
    });

    if (pixCode.error !== null) {
      throw new Error(
        `Abacate Pay SDK error: ${JSON.stringify(pixCode.error)}`,
      );
    }

    const { error: updateError } = await supabaseAdmin
      .from("payments")
      .update({ abacate_pay_charge_id: pixCode.data.id })
      .eq("id", paymentId);

    if (updateError) {
      throw new Error(
        `Failed to update payment record: ${updateError.message}`,
      );
    }

    // Return the PIX data from the SDK response to the frontend
    return new Response(
      JSON.stringify(
        {
          ...pixCode.data,
        } satisfies AbacatePayCharge,
      ),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      },
    );
  } catch (error: unknown) {
    console.error(error);
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
