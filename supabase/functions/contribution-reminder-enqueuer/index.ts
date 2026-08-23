import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import { supabaseAdmin } from "../_shared/supabase-admin.ts";
import {
  isTrustedScheduler,
  jsonResponse,
} from "../_shared/contribution-reminder.ts";

type EnqueueResult = {
  coalesced_count: number;
  created_count: number;
  skipped_count: number;
  suppressed_count: number;
};

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return jsonResponse({ error: "Only POST is supported." }, 405);
  }

  if (!isTrustedScheduler(req)) {
    return jsonResponse({ error: "Scheduler authorization is required." }, 401);
  }

  const { data, error } = await supabaseAdmin.rpc(
    "enqueue_contribution_reminder_events",
  );

  if (error) {
    console.error("Contribution reminder enqueue failed", {
      error: error.message,
    });
    return jsonResponse(
      { error: "Contribution reminder enqueue failed." },
      500,
    );
  }

  const result = (data?.[0] ?? {
    coalesced_count: 0,
    created_count: 0,
    skipped_count: 0,
    suppressed_count: 0,
  }) as EnqueueResult;

  console.log("Contribution reminder enqueue complete", {
    coalesced: result.coalesced_count,
    created: result.created_count,
    skipped: result.skipped_count,
    suppressed: result.suppressed_count,
  });

  return jsonResponse({ ...result });
});
