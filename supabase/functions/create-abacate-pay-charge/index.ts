import AbacatePay from "abacatepay-nodejs-sdk";
import { corsHeaders } from "../_shared/cors.ts";
import type {
  CreateAbacatePayChargePayload,
  AbacatePayCharge,
} from "../_shared/edge-functions.types.ts";

if (!Deno.env.get("ABACATE_PAY_API_KEY")) {
  throw new Error("Missing ABACATE_PAY_API_KEY environment variable.");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { amount }: CreateAbacatePayChargePayload = await req.json();
    if (amount === undefined) {
      throw new Error("amount is required.");
    }

    const abacatePay = AbacatePay.default(Deno.env.get("ABACATE_PAY_API_KEY")!);
    const pixCode = await abacatePay.pixQrCode.create({
      amount: amount,
      description: "Inscrição para se tornar associado da SL.A.C",
      expiresIn: 3600, // 1 hour
    });

    if (pixCode.error !== null) {
      throw new Error(
        `Abacate Pay SDK error: ${JSON.stringify(pixCode.error)}`,
      );
    }

    // Return the PIX data from the SDK response to the frontend
    return new Response(
      JSON.stringify({
        ...pixCode.data,
      } satisfies AbacatePayCharge),
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
