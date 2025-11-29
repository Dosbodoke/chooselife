import { supabaseAdmin } from "../_shared/supabase-admin.ts";
import type { Tables } from "../_shared/database.types.ts";
import { corsHeaders } from "../_shared/cors.ts";

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

async function hasPendingPayment(subscriptionId: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from("payments")
    .select("id")
    .eq("subscription_id", subscriptionId)
    .eq("status", "pending")
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed checking pending payment: ${error.message}`);
  }
  return !!data;
}

async function fetchOrganization(orgId: string) {
  const { data, error } = await supabaseAdmin
    .from("organizations")
    .select("name, monthly_price_amount, annual_price_amount")
    .eq("id", orgId)
    .single();

  if (error) {
    throw new Error(`Failed to fetch organization ${orgId}: ${error.message}`);
  }
  return data;
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

async function createNotification({
  user_id,
  organizationName,
  amount,
}: {
  user_id: string;
  organizationName: string;
  amount: number;
}) {
  const title = {
    pt: `Fique em dia com sua assinatura ${organizationName}`,
  };
  const body = {
    pt: `O pagamento de R$${(amount / 100).toFixed(2)} para o próximo período já está disponível. O vencimento é em 7 dias.`,
  };

  const { error } = await supabaseAdmin
    .from("notifications")
    .insert({ title, body, user_id });

  if (error) throw new Error(`Failed to create notification: ${error.message}`);
}

// ---- CORE LOGIC --------------------------------------------

async function processSubscription(
  sub: Tables<"subscriptions">,
): Promise<void> {
  try {
    if (await hasPendingPayment(sub.id)) {
      console.log(`Subscription ${sub.id} already has a pending payment.`);
      return;
    }

    const org = await fetchOrganization(sub.organization_id);
    const amount = sub.plan_type === "annual"
      ? org.annual_price_amount
      : org.monthly_price_amount;

    if (amount == null) {
      console.error(
        `Missing price for plan ${sub.plan_type} on subscription ${sub.id}`,
      );
      return;
    }

    const newPayment = await createPendingPayment({
      organization_id: sub.organization_id,
      user_id: sub.user_id,
      subscription_id: sub.id,
      amount,
    });

    console.log(
      `Created pending payment ${newPayment.id} for subscription ${sub.id}.`,
    );

    await createNotification({
      user_id: sub.user_id,
      organizationName: org.name,
      amount,
    });

    console.log(`Notification created for user ${sub.user_id}.`);
  } catch (err) {
    console.error(`Error processing subscription ${sub.id}:`, err);
  }
}

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
    await Promise.all(subscriptions.map(processSubscription));

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
