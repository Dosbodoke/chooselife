import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { supabaseAdmin } from "../_shared/supabase-admin.ts";
import { corsHeaders } from "../_shared/cors.ts";

type GeneratorResult = {
  failure_reason: string | null;
  obligation_id: string | null;
  period_key: string | null;
  result: "created" | "already_exists" | "failed";
  schedule_id: string | null;
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

function isTrustedScheduler(req: Request): boolean {
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const authorization = req.headers.get("Authorization");

  return Boolean(
    serviceRoleKey && authorization === `Bearer ${serviceRoleKey}`,
  );
}

async function generateLedgerObligations() {
  const { data, error } = await supabaseAdmin.rpc(
    "generate_membership_billing_obligations",
    {},
  );

  if (error) {
    throw new Error(
      `Failed generating membership billing obligations: ${error.message}`,
    );
  }

  const results = (data ?? []) as GeneratorResult[];
  const created = results.filter((item) => item.result === "created").length;
  const alreadyExisting = results.filter(
    (item) => item.result === "already_exists",
  ).length;
  const failed = results.filter((item) => item.result === "failed");

  if (failed.length > 0) {
    console.error("Membership billing generation failures", {
      count: failed.length,
      reasons: failed.reduce<Record<string, number>>((counts, item) => {
        const reason = item.failure_reason ?? "Unknown generation failure";
        counts[reason] = (counts[reason] ?? 0) + 1;
        return counts;
      }, {}),
    });
  }

  return {
    already_existing: alreadyExisting,
    created,
    failed: failed.length,
    generated: results.length,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Only POST is supported." }, 405);
  }

  if (!isTrustedScheduler(req)) {
    return jsonResponse({ error: "Scheduler authorization is required." }, 401);
  }

  try {
    const result = await generateLedgerObligations();
    console.log("Membership Ledger generation complete", result);
    return jsonResponse(result);
  } catch (error) {
    console.error("Error in generate-renewal-payments:", error);
    return jsonResponse(
      { error: error instanceof Error ? error.message : "Unknown error" },
      500,
    );
  }
});
