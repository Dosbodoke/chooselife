/* To invoke locally:

  1. Run `supabase start` (see: https://supabase.com/docs/reference/cli/supabase-start)
  2. Make an HTTP request:

  curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/create-abacate-pay-charge' \
    --header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0' \
    --header 'Content-Type: application/json' \
    --data '{"name":"Functions"}'

*/


import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
// Import the Abacate Pay SDK from npm
import AbacatePay from "npm:abacatepay";

// Define CORS headers
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { organization_id } = await req.json();
    if (!organization_id) throw new Error("organization_id is required.");

    // Create Supabase client with user's auth context
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: req.headers.get("Authorization")! } } }
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) throw new Error("User not found.");

    const { data: profile, error: profileError } = await supabaseClient
      .from("profiles")
      .select("name")
      .eq("id", user.id)
      .single();
    if (profileError || !profile) throw new Error("Profile not found.");

    // Use an admin client to fetch sensitive price information
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: organization, error: orgError } = await supabaseAdmin
      .from("organizations")
      .select("name, price_amount, price_currency")
      .eq("id", organization_id)
      .single();
    if (orgError || !organization) throw new Error("Organization not found or price not set.");

    // --- Abacate Pay SDK Interaction ---
    const abacatePay = new AbacatePay(Deno.env.get("ABACATE_PAY_API_KEY")!);

    // Create the PIX charge using the SDK
    // The SDK abstracts away the endpoint URL and fetch logic.
    // Note: The method name 'createPixCharge' is an assumption based on typical SDK design.
    // Please verify the correct method and payload structure from the SDK's documentation.
    const chargeResult = await abacatePay.charges.create({
      value: organization.price_amount, // Amount in cents
      customer: {
        name: profile.name,
        email: user.email,
      },
      payment_method: 'pix',
      // Add any other required fields by the SDK
    });

    if (!chargeResult || !chargeResult.id) {
        throw new Error(`Abacate Pay SDK error: ${JSON.stringify(chargeResult)}`);
    }

    // --- Database Update ---
    // Create/update a subscription record to track this payment attempt
    const { error: subscriptionError } = await supabaseAdmin
      .from("subscriptions")
      .upsert({
        user_id: user.id,
        organization_id: organization_id,
        status: "pending_payment",
        abacate_pay_charge_id: chargeResult.id,
      }, { onConflict: "user_id,organization_id" });

    if (subscriptionError) throw subscriptionError;

    // Return the PIX data from the SDK response to the frontend
    return new Response(JSON.stringify({
      pix_emv: chargeResult.pix_emv, // Verify the field name from the SDK docs
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
