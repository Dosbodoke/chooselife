import type { Database } from "@chooselife/database";

import type { BillingWorkspacePaymentRow } from "./billing-workspace";

export type ContributionWaiverResult =
  Database["public"]["Functions"]["waive_recurring_contributions"]["Returns"][number];

/** One overdue month an admin may waive, as the drawer lists it. */
export type WaivableCharge = {
  obligationId: string;
  periodKey: string;
  dueOn: string;
  amount: number;
  currency: string;
};

/** Why `waive_recurring_contributions` refused, as the RPC spells it. */
export type ContributionWaiverFailure =
  | "invalid_selection"
  | "reason_required"
  | "reason_too_long"
  | "under_review"
  | "not_waivable"
  | "unauthorized"
  | "unknown";

/** The RPC refuses longer reasons; the field stops at the same length. */
export const WAIVER_REASON_MAX_LENGTH = 500;

/** The RPC refuses larger batches. Five years of monthly charges. */
export const WAIVER_MAX_SELECTION = 60;

const HINTS: readonly ContributionWaiverFailure[] = [
  "invalid_selection",
  "reason_required",
  "reason_too_long",
  "under_review",
  "not_waivable",
];

/**
 * Every overdue recurring charge of one person, oldest first. The RPC computes
 * `overdue` with the same rule the waiver enforces -- open, past due in the
 * billing timezone, no payment under review -- so this list is what the server
 * would accept, and the server still checks it again.
 *
 * Read from the raw rows, not the ledger's one-row-per-month view, so a month
 * that also holds another charge cannot hide one of them.
 */
export function waivableCharges(
  payments: BillingWorkspacePaymentRow[],
  memberId: string,
): WaivableCharge[] {
  return payments
    .filter(
      (payment) =>
        payment.member_user_id === memberId &&
        payment.purpose === "recurring" &&
        payment.effective_payment_state === "overdue",
    )
    .map((payment) => ({
      obligationId: payment.obligation_id,
      periodKey: payment.period_key,
      dueOn: payment.due_on,
      amount: payment.amount,
      currency: payment.currency,
    }))
    .sort(
      (left, right) =>
        left.dueOn.localeCompare(right.dueOn) ||
        left.obligationId.localeCompare(right.obligationId),
    );
}

/**
 * The selection as it stands against fresh data: a month that was paid,
 * claimed or waived meanwhile drops out, so the review never lists a charge the
 * server would refuse.
 */
export function selectedCharges(
  charges: WaivableCharge[],
  selectedIds: ReadonlySet<string>,
): WaivableCharge[] {
  return charges.filter((charge) => selectedIds.has(charge.obligationId));
}

export function sumCharges(charges: WaivableCharge[]) {
  return charges.reduce((total, charge) => total + charge.amount, 0);
}

/**
 * Collapses whitespace the way the RPC stores it, so what the admin reviews is
 * exactly what the audit trail will say. Null when nothing is left.
 */
export function normalizeWaiverReason(reason: string) {
  const normalized = reason.trim().replace(/\s+/g, " ");
  return normalized ? normalized : null;
}

/**
 * The waiver command refuses with SQLSTATE 22023 or 40001 and names the reason
 * in the hint. Anything it does not recognize -- including a lost response --
 * is unknown, never success: the command may have committed regardless.
 */
export function waiverFailure(error: {
  code?: string;
  hint?: string | null;
}): ContributionWaiverFailure {
  if (error.code === "42501") return "unauthorized";
  return HINTS.find((hint) => hint === error.hint) ?? "unknown";
}
