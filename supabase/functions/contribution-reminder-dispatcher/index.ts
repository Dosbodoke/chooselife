import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import { Expo, type ExpoPushMessage } from "npm:expo-server-sdk@3.15.0";

import { supabaseAdmin } from "../_shared/supabase-admin.ts";
import {
  classifyTransportFailure,
  CONTRIBUTION_REMINDER_COPY,
  CONTRIBUTION_REMINDER_ROUTE,
  isTrustedScheduler,
  jsonResponse,
  normalizeLocale,
} from "../_shared/contribution-reminder.ts";

type ClaimedBatch = {
  batch_id: string;
  lease_token: string;
};

type DeliveryAttempt = {
  attempt_id: string;
  language: string | null;
  token: string;
};

type PreparedBatch = {
  batch_id: string;
  delivery_attempts: DeliveryAttempt[];
  delivery_window_on: string;
  organization_slug: string;
};

type TicketResult = {
  attempt_id: string;
  error_code: string | null;
  expo_ticket_id: string | null;
  status: "error" | "ok";
};

const expo = new Expo({ useFcmV1: true });

function parseAttempts(value: unknown): DeliveryAttempt[] {
  return Array.isArray(value) ? value as DeliveryAttempt[] : [];
}

function parseClaimedBatches(value: unknown): ClaimedBatch[] {
  return Array.isArray(value) ? value as ClaimedBatch[] : [];
}

async function recordTickets(
  batch: ClaimedBatch,
  tickets: TicketResult[],
) {
  if (tickets.length === 0) return;

  const { error } = await supabaseAdmin.rpc(
    "record_contribution_reminder_tickets",
    {
      p_batch_id: batch.batch_id,
      p_lease_token: batch.lease_token,
      p_tickets: tickets,
    },
  );

  if (error) throw error;
}

async function dispatchBatch(batch: ClaimedBatch): Promise<{
  batches: number;
  failed: number;
  messages: number;
  ticketed: number;
}> {
  const { data, error } = await supabaseAdmin.rpc(
    "prepare_contribution_reminder_batch",
    {
      p_batch_id: batch.batch_id,
      p_lease_token: batch.lease_token,
      p_lease_seconds: 180,
    },
  );

  if (error) throw error;

  const prepared = (data?.[0] ?? null) as PreparedBatch | null;
  if (!prepared) {
    return { batches: 0, failed: 0, messages: 0, ticketed: 0 };
  }

  const attempts = parseAttempts(prepared.delivery_attempts);
  if (attempts.length === 0) {
    return { batches: 1, failed: 0, messages: 0, ticketed: 0 };
  }

  const messages: Array<
    { attempt: DeliveryAttempt; message: ExpoPushMessage }
  > = [];
  const tickets: TicketResult[] = [];

  for (const attempt of attempts) {
    if (!Expo.isExpoPushToken(attempt.token)) {
      tickets.push({
        attempt_id: attempt.attempt_id,
        error_code: "InvalidPushToken",
        expo_ticket_id: null,
        status: "error",
      });
      continue;
    }

    const locale = normalizeLocale(attempt.language);
    const copy = CONTRIBUTION_REMINDER_COPY[locale];
    messages.push({
      attempt,
      message: {
        to: attempt.token,
        sound: "default",
        priority: "high",
        title: copy.title,
        body: copy.body,
        data: {
          type: "contribution_reminder",
          organization_slug: prepared.organization_slug,
          url: CONTRIBUTION_REMINDER_ROUTE,
        },
      },
    });
  }

  let failed = 0;
  let ticketed = 0;
  let messageOffset = 0;
  const chunks = expo
    .chunkPushNotifications(messages.map(({ message }) => message))
    .map((chunk) => {
      const chunkWithOffset = { chunk, messageOffset };
      messageOffset += chunk.length;
      return chunkWithOffset;
    });
  let transportFailure: unknown = null;

  try {
    const chunkResults = await Promise.all(
      chunks.map(async ({ chunk, messageOffset: chunkOffset }) => {
        try {
          return {
            chunk,
            messageOffset: chunkOffset,
            results: await expo.sendPushNotificationsAsync(chunk),
            error: null,
          };
        } catch (error) {
          return {
            chunk,
            messageOffset: chunkOffset,
            results: null,
            error,
          };
        }
      }),
    );

    for (const chunkResult of chunkResults) {
      if (chunkResult.results === null) {
        transportFailure ??= chunkResult.error ?? new Error("Expo send failed");
        failed += 1;
        continue;
      }

      chunkResult.results.forEach((ticket, index) => {
        const attempt = messages[chunkResult.messageOffset + index]?.attempt;
        if (!attempt) return;

        if (ticket.status === "ok") {
          ticketed += 1;
          tickets.push({
            attempt_id: attempt.attempt_id,
            error_code: null,
            expo_ticket_id: ticket.id,
            status: "ok",
          });
          return;
        }

        failed += 1;
        tickets.push({
          attempt_id: attempt.attempt_id,
          error_code: ticket.details?.error ?? "ExpoTicketError",
          expo_ticket_id: null,
          status: "error",
        });
      });

      for (
        let index = chunkResult.results.length;
        index < chunkResult.chunk.length;
        index += 1
      ) {
        const attempt = messages[chunkResult.messageOffset + index]?.attempt;
        if (!attempt) continue;

        failed += 1;
        tickets.push({
          attempt_id: attempt.attempt_id,
          error_code: "Network",
          expo_ticket_id: null,
          status: "error",
        });
      }
    }
  } catch (error) {
    await recordTickets(batch, tickets);
    await supabaseAdmin.rpc("record_contribution_reminder_send_failure", {
      p_batch_id: batch.batch_id,
      p_failure_code: classifyTransportFailure(error),
      p_lease_token: batch.lease_token,
    });
    return {
      batches: 1,
      failed: failed + 1,
      messages: attempts.length,
      ticketed,
    };
  }

  if (transportFailure !== null) {
    await recordTickets(batch, tickets);
    await supabaseAdmin.rpc("record_contribution_reminder_send_failure", {
      p_batch_id: batch.batch_id,
      p_failure_code: classifyTransportFailure(transportFailure),
      p_lease_token: batch.lease_token,
    });
    return {
      batches: 1,
      failed,
      messages: attempts.length,
      ticketed,
    };
  }

  await recordTickets(batch, tickets);

  return {
    batches: 1,
    failed,
    messages: attempts.length,
    ticketed,
  };
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return jsonResponse({ error: "Only POST is supported." }, 405);
  }

  if (!isTrustedScheduler(req)) {
    return jsonResponse({ error: "Scheduler authorization is required." }, 401);
  }

  const { data, error } = await supabaseAdmin.rpc(
    "claim_contribution_reminder_batches",
    { p_limit: 20, p_lease_seconds: 180 },
  );

  if (error) {
    console.error("Contribution reminder batch claim failed", {
      error: error.message,
    });
    return jsonResponse(
      { error: "Contribution reminder dispatch failed." },
      500,
    );
  }

  const batches = parseClaimedBatches(data);
  const summary = {
    batches: 0,
    failed: 0,
    messages: 0,
    ticketed: 0,
  };

  const dispatchResults = await Promise.all(
    batches.map(async (batch) => {
      try {
        return { result: await dispatchBatch(batch) };
      } catch (error) {
        console.error("Contribution reminder batch dispatch failed", {
          error: error instanceof Error ? error.message : "Unknown error",
        });
        await supabaseAdmin.rpc("record_contribution_reminder_send_failure", {
          p_batch_id: batch.batch_id,
          p_failure_code: classifyTransportFailure(error),
          p_lease_token: batch.lease_token,
        });
        return { result: null };
      }
    }),
  );

  for (const { result } of dispatchResults) {
    if (!result) {
      summary.failed += 1;
      continue;
    }

    summary.batches += result.batches;
    summary.failed += result.failed;
    summary.messages += result.messages;
    summary.ticketed += result.ticketed;
  }

  console.log("Contribution reminder dispatch complete", summary);
  return jsonResponse(summary);
});
