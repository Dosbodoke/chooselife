import { supabaseAdmin } from "../_shared/supabase-admin.ts";
import { corsHeaders } from "../_shared/cors.ts";
import {
  processSubscription,
  type RenewalNotification,
  type RenewalOrganization,
} from "./renewal-payment.ts";

// ---- UTILS -------------------------------------------------

function calculateRenewalDate(daysAhead = 7): Date {
  const date = new Date();
  date.setDate(date.getDate() + daysAhead);
  return date;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

// ---- DATABASE HELPERS --------------------------------------

async function fetchSubscriptionsDueForRenewal(renewalDate: Date) {
  const { data, error } = await supabaseAdmin
    .from("subscriptions")
    .select("*")
    .eq("status", "active")
    .lte("current_period_end", renewalDate.toISOString());

  if (error) throw new Error(`Failed to fetch subscriptions: ${error.message}`);
  return data ?? [];
}

async function findPendingPayment(subscriptionId: string) {
  const { data, error } = await supabaseAdmin
    .from("payments")
    .select("id, amount")
    .eq("subscription_id", subscriptionId)
    .eq("status", "pending")
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed checking pending payment: ${error.message}`);
  }
  return data;
}

async function hasRenewalNotification(paymentId: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from("notifications")
    .select("id")
    .contains("data", {
      payment_id: paymentId,
      type: "subscription_renewal_payment_ready",
    })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed checking renewal notification: ${error.message}`);
  }
  return !!data;
}

async function fetchOrganization(orgId: string) {
  const { data, error } = await supabaseAdmin
    .from("organizations")
    .select("name, slug, monthly_price_amount, annual_price_amount")
    .eq("id", orgId)
    .single();

  if (error) {
    throw new Error(`Failed to fetch organization ${orgId}: ${error.message}`);
  }
  return data satisfies RenewalOrganization;
}

async function createPendingPayment({
  organization_id,
  user_id,
  subscription_id,
  amount,
}: {
  organization_id: string;
  user_id: string;
  subscription_id: string;
  amount: number;
}) {
  const { data, error } = await supabaseAdmin
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

  if (error) throw new Error(`Failed to create payment: ${error.message}`);
  return data;
}

async function createNotification(notification: RenewalNotification) {
  const { error } = await supabaseAdmin
    .from("notifications")
    .insert(notification);

  if (error) throw new Error(`Failed to create notification: ${error.message}`);
}

// ---- CORE LOGIC --------------------------------------------

const renewalPaymentDependencies = {
  createNotification,
  createPendingPayment,
  fetchOrganization,
  findPendingPayment,
  hasRenewalNotification,
};

// ---- ENTRYPOINT --------------------------------------------

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const renewalDate = calculateRenewalDate(7);
    console.log(
      `Checking for subscriptions ending before ${renewalDate.toISOString()}`,
    );

    const subscriptions = await fetchSubscriptionsDueForRenewal(renewalDate);

    if (subscriptions.length === 0) {
      console.log("No subscriptions to renew.");
      return jsonResponse({ message: "No subscriptions to renew." });
    }

    console.log(`Processing ${subscriptions.length} subscriptions...`);
    await Promise.all(
      subscriptions.map((subscription) =>
        processSubscription(subscription, renewalPaymentDependencies)
      ),
    );

    console.log("Renewal check complete.");
    return jsonResponse({ message: "Renewal check complete." });
  } catch (error) {
    console.error("Error in generate-renewal-payments:", error);
    return jsonResponse(
      { error: error instanceof Error ? error.message : "Unknown error" },
      500,
    );
  }
});
