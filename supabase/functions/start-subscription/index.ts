import { createSupabaseClient } from "../_shared/supabase-client.ts";
import { corsHeaders } from "../_shared/cors.ts";
import type {
  AbacatePayCharge,
  CreateAbacatePayChargePayload,
} from "../_shared/edge-functions.types.ts";

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: corsHeaders,
    });
  }

  try {
    const supabaseAdmin = createSupabaseClient(
      req.headers.get("Authorization")!,
    );

    // 1. Get user from Authorization header
    const { data: { user } } = await supabaseAdmin.auth.getUser();
    if (!user) {
      throw new Error("User not authenticated");
    }

    // 2. Get parameters from request body
    const { plan_type, organizationID }: {
      organizationID: string;
      plan_type: "monthly" | "annual";
    } = await req.json();
    if (!plan_type) {
      throw new Error("plan_type is required");
    }
    if (!organizationID) {
      throw new Error("organizationID is required");
    }

    // 3. Fetch organization price from the database
    const { data: orgData, error: orgError } = await supabaseAdmin
      .from("organizations")
      .select("id, monthly_price_amount, annual_price_amount")
      .eq("id", organizationID)
      .single();

    if (orgError) throw orgError;
    if (!orgData) throw new Error("Organization not found");

    const amount = plan_type === "annual"
      ? orgData.annual_price_amount
      : orgData.monthly_price_amount;

    if (amount === null || amount === undefined) {
      throw new Error("Price not set for this plan type");
    }

    // 4. Create the subscription record
    const { data: subData, error: subError } = await supabaseAdmin
      .from("subscriptions")
      .upsert({
        organization_id: orgData.id,
        user_id: user.id,
        status: "pending_payment",
        plan_type,
      }, { onConflict: "user_id,organization_id" })
      .select("id")
      .single();

    if (subError) throw subError;
    if (!subData) throw new Error("Could not create subscription");

    // 5. Invoke the reusable 'create-abacate-pay-charge' function
    const { data: chargeData, error: chargeError } = await supabaseAdmin
      .functions.invoke<AbacatePayCharge>(
        "create-abacate-pay-charge",
        {
          body: {
            amount,
          } satisfies CreateAbacatePayChargePayload,
        },
      );

    if (chargeError) {
      const errorDetails = await chargeError.context?.json();
      throw new Error(
        `Failed to create payment charge: ${
          errorDetails?.error || chargeError.message
        }`,
      );
    }

    if (!chargeData) {
      throw new Error(
        "No charge data received from 'create-abacate-pay-charge'",
      );
    }

    if (!chargeData.id) {
      throw new Error(
        "id not found in 'create-abacate-pay-charge' response",
      );
    }

    // 6. Create the initial payment record with the charge ID
    const { error: paymentError } = await supabaseAdmin
      .from("payments")
      .insert({
        organization_id: orgData.id,
        user_id: user.id,
        subscription_id: subData.id,
        amount,
        status: "pending",
        abacate_pay_charge_id: chargeData.id,
      });

    if (paymentError) throw paymentError;

    // 7. Return the successful charge data to the client
    return new Response(
      JSON.stringify(chargeData satisfies AbacatePayCharge),
      {
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      },
    );
  } catch (error) {
    console.error(error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error
          ? error.message
          : "Unknown Error instance",
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      },
    );
  }
});
