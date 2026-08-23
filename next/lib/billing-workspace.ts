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

export type InitialPaymentClaimDetail =
  Database["public"]["Functions"]["get_initial_payment_claim_detail"]["Returns"][number];

export type BillingWorkspaceView = "queue" | "payments" | "members";

export type BillingWorkspaceClaimDetailResult =
  | BillingWorkspaceClaimDetail
  | InitialPaymentClaimDetail;

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

export function jsonArray(value: Json | null | undefined): BillingHistoryEntry[] {
  return Array.isArray(value) ? (value as BillingHistoryEntry[]) : [];
}

export function formatBillingDate(value: string | null | undefined) {
  if (!value) return "—";

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(`${value}T00:00:00`));
}

export function formatBillingDateTime(value: string | null | undefined) {
  if (!value) return "—";

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(value));
}

export function formatBillingAmount(amount: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(amount / 100);
}

export function purposeLabel(
  purpose: Database["public"]["Enums"]["payment_obligation_purpose_enum"],
) {
  return purpose === "recurring" ? "Recurring contribution" : "Initial admission";
}

export function planLabel(
  plan: Database["public"]["Enums"]["subscription_plan_type_enum"] | null,
) {
  if (!plan) return "No active plan";
  return plan === "annual" ? "Annual" : "Monthly";
}

export function paymentStateLabel(state: string) {
  return state
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
