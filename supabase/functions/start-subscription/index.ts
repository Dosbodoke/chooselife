import type { SupabaseClient } from "@supabase";
import { createSupabaseClient } from "../_shared/supabase-client.ts";
import { supabaseAdmin } from "../_shared/supabase-admin.ts";
import { corsHeaders } from "../_shared/cors.ts";
import type { PaymentCheckoutSession } from "../_shared/edge-functions.types.ts";
import type { Database } from "../_shared/database.types.ts";

// Helper function to handle CORS preflight requests
function handleCors(req: Request): Response | null {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  return null;
}

type User = {
  id: string;
};

async function getUser(supabase: SupabaseClient): Promise<User> {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error) throw error;
  if (!user) throw new Error("User not authenticated");
  return { id: user.id };
}

type Organization = Pick<
  Database["public"]["Tables"]["organizations"]["Row"],
  "id" | "monthly_price_amount" | "annual_price_amount"
>;

async function getOrganization(
  supabase: SupabaseClient,
  slug: string,
): Promise<Organization> {
  const { data: orgData, error: orgError } = await supabase
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

async function findPendingManualPayment(
  supabaseAdmin: SupabaseClient,
  { organization_id, user_id, subscription_id, amount }: {
    organization_id: string;
    user_id: string;
    subscription_id: string;
    amount: number;
  },
): Promise<{ id: string; amount: number } | null> {
  const { data: paymentData, error: paymentError } = await supabaseAdmin
    .from("payments")
    .select("id, amount")
    .eq("organization_id", organization_id)
    .eq("user_id", user_id)
    .eq("subscription_id", subscription_id)
    .eq("amount", amount)
    .eq("status", "pending")
    .is("payment_provider", null)
    .is("provider_payment_id", null)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (paymentError) throw paymentError;

  return paymentData;
}

async function findOrCreatePayment(
  supabaseAdmin: SupabaseClient,
  params: {
    organization_id: string;
    user_id: string;
    subscription_id: string;
    amount: number;
  },
): Promise<{ id: string; amount: number }> {
  const existingPayment = await findPendingManualPayment(supabaseAdmin, params);
  if (existingPayment) return existingPayment;

  const newPayment = await createPayment(supabaseAdmin, params);
  return { id: newPayment.id, amount: params.amount };
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
    const supabase = createSupabaseClient(
      req.headers.get("Authorization")!,
    );

    const { plan_type, slug } = await getRequestPayload(req);

    const user = await getUser(supabase);
    const organization = await getOrganization(supabase, slug);
    const amount = getAmount(organization, plan_type);

    const subscription = await upsertSubscription(supabaseAdmin, {
      organization_id: organization.id,
      user_id: user.id,
      plan_type,
    });

    const payment = await findOrCreatePayment(supabaseAdmin, {
      organization_id: organization.id,
      user_id: user.id,
      subscription_id: subscription.id,
      amount,
    });

    const checkoutData: PaymentCheckoutSession = {
      amount: payment.amount,
      method: "manual_pix",
      paymentId: payment.id,
      provider: "manual",
    };

    return new Response(
      JSON.stringify(checkoutData),
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
