import type { SupabaseClient } from "@supabase";
import { createSupabaseClient } from "../_shared/supabase-client.ts";
import { corsHeaders } from "../_shared/cors.ts";
import type {
  AbacatePayCharge,
  CreateAbacatePayChargePayload,
} from "../_shared/edge-functions.types.ts";
import type { Database } from "../../../packages/database/index.ts";

// Helper function to handle CORS preflight requests
function handleCors(req: Request): Response | null {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  return null;
}

type User = {
  id: string;
  email: string;
};

async function getUser(supabaseAdmin: SupabaseClient): Promise<User> {
  const { data: { user }, error } = await supabaseAdmin.auth.getUser();
  if (error) throw error;
  if (!user) throw new Error("User not authenticated");
  if (!user.email) throw new Error("User email is missing");
  return { id: user.id, email: user.email };
}

type Organization = Pick<
  Database["public"]["Tables"]["organizations"]["Row"],
  "id" | "monthly_price_amount" | "annual_price_amount"
>;

async function getOrganization(
  supabaseAdmin: SupabaseClient,
  slug: string,
): Promise<Organization> {
  const { data: orgData, error: orgError } = await supabaseAdmin
    .from("organizations")
    .select("id, monthly_price_amount, annual_price_amount")
    .eq("slug", slug)
    .single();

  if (orgError) throw orgError;
  if (!orgData) throw new Error("Organization not found");

  return orgData;
}

function getAmount(
  orgData: Organization,
  plan_type: "monthly" | "annual",
): number {
  const amount = plan_type === "annual"
    ? orgData.annual_price_amount
    : orgData.monthly_price_amount;

  if (amount === null || amount === undefined) {
    throw new Error("Price not set for this plan type");
  }
  return amount;
}

async function upsertSubscription(
  supabaseAdmin: SupabaseClient,
  { organization_id, user_id, plan_type }: {
    organization_id: string;
    user_id: string;
    plan_type: "monthly" | "annual";
  },
): Promise<{ id: string }> {
  const { data: subData, error: subError } = await supabaseAdmin
    .from("subscriptions")
    .upsert({
      organization_id,
      user_id,
      status: "pending_payment",
      plan_type,
    }, { onConflict: "user_id,organization_id" })
    .select("id")
    .single();

  if (subError) throw subError;
  if (!subData) throw new Error("Could not create subscription");

  return subData;
}

async function createPayment(
  supabaseAdmin: SupabaseClient,
  { organization_id, user_id, subscription_id, amount }: {
    organization_id: string;
    user_id: string;
    subscription_id: string;
    amount: number;
  },
): Promise<{ id: string }> {
  const { data: paymentData, error: paymentError } = await supabaseAdmin
    .from("payments")
    .insert({
      organization_id,
      user_id,
      subscription_id,
      amount,
      status: "pending",
    })
    .select("id")
    .single();

  if (paymentError) throw paymentError;
  if (!paymentData) throw new Error("Could not create payment record");

  return paymentData;
}

async function createCharge(
  supabaseAdmin: SupabaseClient,
  { amount, paymentId, customer }: CreateAbacatePayChargePayload,
): Promise<AbacatePayCharge> {
  const { data: chargeData, error: chargeError } = await supabaseAdmin
    .functions.invoke<AbacatePayCharge>(
      "create-abacate-pay-charge",
      {
        body: {
          amount,
          paymentId,
          customer,
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

  return chargeData;
}

type RequestPayload = {
  slug: string;
  plan_type: "monthly" | "annual";
};

async function getRequestPayload(req: Request): Promise<RequestPayload> {
  const { plan_type, slug }: RequestPayload = await req.json();
  if (!plan_type) throw new Error("plan_type is required");
  if (!slug) throw new Error("slug is required");
  return { plan_type, slug };
}

Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const supabaseAdmin = createSupabaseClient(
      req.headers.get("Authorization")!,
    );

    const { plan_type, slug } = await getRequestPayload(req);

    const user = await getUser(supabaseAdmin);
    const organization = await getOrganization(supabaseAdmin, slug);
    const amount = getAmount(organization, plan_type);

    const subscription = await upsertSubscription(supabaseAdmin, {
      organization_id: organization.id,
      user_id: user.id,
      plan_type,
    });

    const payment = await createPayment(supabaseAdmin, {
      organization_id: organization.id,
      user_id: user.id,
      subscription_id: subscription.id,
      amount,
    });

    const chargeData = await createCharge(supabaseAdmin, {
      amount,
      paymentId: payment.id,
      customer: undefined,
    });

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
