import type { Database, Json } from "@chooselife/database";

export type BillingWorkspaceOrganization =
  Database["public"]["Functions"]["get_billing_workspace_organizations"]["Returns"][number];

export type BillingWorkspaceQueueRow =
  Database["public"]["Functions"]["get_billing_workspace_queue"]["Returns"][number];

export type BillingWorkspaceClaimDetail =
  Database["public"]["Functions"]["get_billing_workspace_claim_detail"]["Returns"][number];

export type BillingWorkspacePaymentRow =
  Database["public"]["Functions"]["get_billing_workspace_payments"]["Returns"][number];

export type BillingWorkspaceMemberRow =
  Database["public"]["Functions"]["get_billing_workspace_members"]["Returns"][number];

export type BillingWorkspacePersonRow =
  Database["public"]["Functions"]["get_billing_workspace_people"]["Returns"][number];

export type InitialPaymentClaimDetail =
  Database["public"]["Functions"]["get_initial_payment_claim_detail"]["Returns"][number];

export type BillingWorkspaceView = "queue" | "payments" | "members";

export type BillingWorkspaceClaimDetailResult =
  BillingWorkspaceClaimDetail | InitialPaymentClaimDetail;

export type BillingHistoryEntry = {
  actor_handle?: string | null;
  actor_name?: string | null;
  actor_user_id?: string | null;
  claim_id?: string | null;
  created_at?: string | null;
  decided_at?: string | null;
  decision_reason?: string | null;
  id?: string | null;
  next_state?: string | null;
  payer_name?: string | null;
  payer_type?: string | null;
  previous_state?: string | null;
  reason?: string | null;
  status?: string | null;
};

function intlLocale(locale: string) {
  return locale.toLowerCase().startsWith("pt") ? "pt-BR" : "en-US";
}

/**
 * Refusing an enrollment is one action carrying one reason. `reject_initial_claim`
 * refuses the application, rejects the claim and voids its obligation in a single
 * command, and it requires a normalized non-empty reason (SQLSTATE 22023), so the
 * admin surface normalizes the same way before sending. Returns null when the
 * reason is absent or whitespace-only.
 */
export function normalizeDecisionReason(reason: string | null | undefined) {
  const normalized = reason?.trim().replace(/\s+/g, " ");

  return normalized ? normalized : null;
}

export function jsonArray(
  value: Json | null | undefined,
): BillingHistoryEntry[] {
  return Array.isArray(value) ? (value as BillingHistoryEntry[]) : [];
}

export function formatBillingDate(
  value: string | null | undefined,
  locale = "en-US",
) {
  if (!value) return "—";

  return new Intl.DateTimeFormat(intlLocale(locale), {
    dateStyle: "medium",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(`${value}T00:00:00`));
}

export function formatBillingDateTime(
  value: string | null | undefined,
  locale = "en-US",
) {
  if (!value) return "—";

  return new Intl.DateTimeFormat(intlLocale(locale), {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(value));
}

export function formatBillingAmount(
  amount: number,
  currency: string,
  locale = "en-US",
) {
  return new Intl.NumberFormat(intlLocale(locale), {
    style: "currency",
    currency,
  }).format(amount / 100);
}
