import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { supabaseAdmin } from "../_shared/supabase-admin.ts";
import { corsHeaders } from "../_shared/cors.ts";

type Locale = "en" | "pt";

type GeneratedObligation = {
  id: string;
  organization_id: string;
  user_id: string;
  amount: number;
  currency: string;
  due_on: string;
  period_key: string;
  plan_type: "monthly" | "annual";
  organization: {
    name: string;
    slug: string;
    billing_timezone: string;
  };
};

type GeneratorResult = {
  failure_reason: string | null;
  obligation_id: string | null;
  period_key: string;
  result: string;
  schedule_id: string;
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

function formatAmount(
  amount: number,
  currency: string,
  locale: Locale,
): string {
  return new Intl.NumberFormat(locale === "pt" ? "pt-BR" : "en-US", {
    currency,
    style: "currency",
  }).format(amount / 100);
}

function formatCalendarDate(date: string, locale: Locale): string {
  const parsed = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return date;

  return new Intl.DateTimeFormat(locale === "pt" ? "pt-BR" : "en-US", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "UTC",
    year: "numeric",
  }).format(parsed);
}

function getLocalDate(timezone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    month: "2-digit",
    timeZone: timezone,
    year: "numeric",
  }).formatToParts(new Date());
  const values = Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );

  return `${values.year}-${values.month}-${values.day}`;
}

export function buildRecurringPaymentUrl({
  amount,
  currency,
  obligationId,
  organizationSlug,
}: {
  amount: number;
  currency: string;
  obligationId: string;
  organizationSlug: string;
}): string {
  const params = new URLSearchParams({
    amount: String(amount),
    currency,
    obligationId,
    paymentContext: "subscription_renewal",
    slug: organizationSlug,
  });

  return `/payment?${params.toString()}`;
}

function buildNotification(obligation: GeneratedObligation) {
  const isOverdue =
    obligation.due_on < getLocalDate(obligation.organization.billing_timezone);
  const amountPt = formatAmount(obligation.amount, obligation.currency, "pt");
  const amountEn = formatAmount(obligation.amount, obligation.currency, "en");
  const dueDatePt = formatCalendarDate(obligation.due_on, "pt");
  const dueDateEn = formatCalendarDate(obligation.due_on, "en");

  return {
    user_id: obligation.user_id,
    title: {
      en: isOverdue
        ? "Your membership contribution needs attention"
        : "Your membership contribution is ready",
      pt: isOverdue
        ? "Sua contribuição precisa de atenção"
        : "Sua contribuição está disponível",
    },
    body: {
      en: isOverdue
        ? `Your ${amountEn} contribution for ${obligation.organization.name} is overdue. Open the Ledger to regularize it.`
        : `Your ${amountEn} contribution for ${obligation.organization.name} is ready. Pay by ${dueDateEn}.`,
      pt: isOverdue
        ? `Sua contribuição de ${amountPt} para ${obligation.organization.name} está em atraso. Abra o Ledger para regularizar.`
        : `Sua contribuição de ${amountPt} para ${obligation.organization.name} está disponível. Pague até ${dueDatePt}.`,
    },
    data: {
      amount: String(obligation.amount),
      currency: obligation.currency,
      obligation_id: obligation.id,
      organization_id: obligation.organization_id,
      organization_slug: obligation.organization.slug,
      payment_context: "subscription_renewal",
      period_key: obligation.period_key,
      type: "recurring_contribution_payment_ready",
      url: buildRecurringPaymentUrl({
        amount: obligation.amount,
        currency: obligation.currency,
        obligationId: obligation.id,
        organizationSlug: obligation.organization.slug,
      }),
    },
  };
}

async function hasLedgerNotification(obligation: GeneratedObligation) {
  const { data, error } = await supabaseAdmin
    .from("notifications")
    .select("id")
    .eq("user_id", obligation.user_id)
    .contains("data", {
      obligation_id: obligation.id,
      type: "recurring_contribution_payment_ready",
    })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(
      `Failed checking Ledger notification for ${obligation.id}: ${error.message}`,
    );
  }

  return Boolean(data);
}

async function createLedgerNotification(obligation: GeneratedObligation) {
  const { error } = await supabaseAdmin
    .from("notifications")
    .insert(buildNotification(obligation));

  if (error) {
    throw new Error(
      `Failed creating Ledger notification for ${obligation.id}: ${error.message}`,
    );
  }
}

async function generateLedgerObligations() {
  const { data: generated, error: generationError } = await supabaseAdmin.rpc(
    "generate_membership_billing_obligations",
    { p_as_of: new Date().toISOString() },
  );

  if (generationError) {
    throw new Error(
      `Failed generating membership billing obligations: ${generationError.message}`,
    );
  }

  const results = (generated ?? []) as GeneratorResult[];
  const obligationIds = [
    ...new Set(
      results
        .filter((result) => result.obligation_id)
        .map((result) => result.obligation_id as string),
    ),
  ];

  if (obligationIds.length === 0) {
    return {
      generated: results.length,
      notified: 0,
      results,
    };
  }

  const { data: obligations, error: obligationError } = await supabaseAdmin
    .from("payment_obligations")
    .select(
      "id, organization_id, user_id, amount, currency, due_on, period_key, plan_type, organization:organizations!inner(name, slug, billing_timezone)",
    )
    .in("id", obligationIds);

  if (obligationError) {
    throw new Error(
      `Failed loading generated Ledger obligations: ${obligationError.message}`,
    );
  }

  const typedObligations = (obligations ??
    []) as unknown as GeneratedObligation[];
  let notified = 0;

  for (const obligation of typedObligations) {
    if (await hasLedgerNotification(obligation)) continue;

    await createLedgerNotification(obligation);
    notified += 1;
  }

  return {
    generated: results.length,
    notified,
    results,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const result = await generateLedgerObligations();
    console.log(
      `Membership Ledger generation complete: ${result.generated} periods, ${result.notified} notifications.`,
    );
    return jsonResponse(result);
  } catch (error) {
    console.error("Error in generate-renewal-payments:", error);
    return jsonResponse(
      { error: error instanceof Error ? error.message : "Unknown error" },
      500,
    );
  }
});
