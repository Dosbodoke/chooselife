import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import { Expo } from "npm:expo-server-sdk@3.15.0";

import { supabaseAdmin } from "../_shared/supabase-admin.ts";
import {
  classifyTransportFailure,
  isTrustedScheduler,
  jsonResponse,
} from "../_shared/contribution-reminder.ts";

type ClaimedReceipt = {
  attempt_id: string;
  batch_id: string;
  expo_ticket_id: string;
  lease_token: string;
};

type ReceiptResult = {
  attempt_id: string;
  error_code: string | null;
  lease_token: string;
  status: "error" | "ok";
};

const expo = new Expo({ useFcmV1: true });

function parseClaimedReceipts(value: unknown): ClaimedReceipt[] {
  return Array.isArray(value) ? value as ClaimedReceipt[] : [];
}

async function recordReceipts(receipts: ReceiptResult[]) {
  if (receipts.length === 0) return;

  const { error } = await supabaseAdmin.rpc(
    "record_contribution_reminder_receipts",
    { p_receipts: receipts },
  );

  if (error) throw error;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return jsonResponse({ error: "Only POST is supported." }, 405);
  }

  if (!isTrustedScheduler(req)) {
    return jsonResponse({ error: "Scheduler authorization is required." }, 401);
  }

  const { data, error } = await supabaseAdmin.rpc(
    "claim_contribution_reminder_receipts",
    { p_limit: 100, p_lease_seconds: 180 },
  );

  if (error) {
    console.error("Contribution reminder receipt claim failed", {
      error: error.message,
    });
    return jsonResponse(
      { error: "Contribution reminder receipts failed." },
      500,
    );
  }

  const claimed = parseClaimedReceipts(data);
  if (claimed.length === 0) {
    return jsonResponse({ claimed: 0, delivered: 0, failed: 0 });
  }

  const receipts: ReceiptResult[] = [];
  const ticketIds = claimed.map(({ expo_ticket_id }) => expo_ticket_id);

  try {
    const expoReceipts = await expo.getPushNotificationReceiptsAsync(ticketIds);

    for (const receipt of claimed) {
      const result = expoReceipts[receipt.expo_ticket_id];
      if (!result) {
        receipts.push({
          attempt_id: receipt.attempt_id,
          error_code: "Network",
          lease_token: receipt.lease_token,
          status: "error",
        });
        continue;
      }

      if (result.status === "ok") {
        receipts.push({
          attempt_id: receipt.attempt_id,
          error_code: null,
          lease_token: receipt.lease_token,
          status: "ok",
        });
      } else {
        receipts.push({
          attempt_id: receipt.attempt_id,
          error_code: result.details?.error ?? "ExpoReceiptError",
          lease_token: receipt.lease_token,
          status: "error",
        });
      }
    }
  } catch (error) {
    const failureCode = classifyTransportFailure(error);
    for (const receipt of claimed) {
      receipts.push({
        attempt_id: receipt.attempt_id,
        error_code: failureCode,
        lease_token: receipt.lease_token,
        status: "error",
      });
    }
  }

  try {
    await recordReceipts(receipts);
  } catch (error) {
    console.error("Contribution reminder receipts could not be persisted", {
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return jsonResponse(
      { error: "Contribution reminder receipts failed." },
      500,
    );
  }

  const delivered = receipts.filter((receipt) =>
    receipt.status === "ok"
  ).length;
  const failed = receipts.length - delivered;
  const summary = { claimed: claimed.length, delivered, failed };
  console.log("Contribution reminder receipt reconciliation complete", summary);
  return jsonResponse(summary);
});
