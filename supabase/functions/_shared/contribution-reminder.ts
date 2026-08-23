import { corsHeaders } from "./cors.ts";

export const CONTRIBUTION_REMINDER_ROUTE = "/(tabs)/organizations";

export const CONTRIBUTION_REMINDER_COPY = {
  en: {
    body: "Open the association Ledger to review your account.",
    title: "Association Ledger",
  },
  pt: {
    body: "Abra o Ledger da associação para consultar sua conta.",
    title: "Ledger da associação",
  },
} as const;

export type ReminderLocale = keyof typeof CONTRIBUTION_REMINDER_COPY;

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

export function isTrustedScheduler(req: Request): boolean {
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const authorization = req.headers.get("Authorization");

  return Boolean(
    serviceRoleKey && authorization === `Bearer ${serviceRoleKey}`,
  );
}

export function classifyTransportFailure(error: unknown):
  | "network"
  | "rate_limit"
  | "server" {
  const message = error instanceof Error
    ? error.message.toLowerCase()
    : String(error).toLowerCase();

  if (
    message.includes("429") ||
    message.includes("rate") ||
    message.includes("too many")
  ) {
    return "rate_limit";
  }

  if (
    message.includes("500") ||
    message.includes("502") ||
    message.includes("503") ||
    message.includes("504") ||
    message.includes("server")
  ) {
    return "server";
  }

  return "network";
}

export function normalizeLocale(
  value: string | null | undefined,
): ReminderLocale {
  return value === "en" ? "en" : "pt";
}
