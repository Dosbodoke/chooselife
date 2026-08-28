import assert from "node:assert/strict";
import test from "node:test";

import type {
  BillingWorkspacePaymentRow,
  BillingWorkspacePersonRow,
} from "./billing-workspace";
// Node's native TypeScript runner requires an explicit extension.
// @ts-expect-error TypeScript resolves the same source file for the web build.
import { buildBillingWorkspaceMemberRows } from "./billing-workspace-ledger.ts";

/**
 * Supabase's generator types every `RETURNS TABLE` column as non-nullable, but
 * the RPC's left joins genuinely return nulls -- which is exactly what the
 * mapping defends against with `??`. These fixtures model the wire truth, so
 * they are cast past that optimism rather than pretending the nulls are absent.
 */
type Nullable<T> = { [K in keyof T]: T[K] | null };

const person = {
  member_user_id: "user-1",
  member_name: "Pagamento Rejeitado",
  member_handle: "@seed_rejeitado",
  member_profile_picture: null,
  member_role: null,
  lifecycle_status: "pending",
  application_status: "submitted",
  joined_at: null,
  plan_type: "annual",
  last_verified_contribution_at: null,
} as unknown as BillingWorkspacePersonRow;

/** Mirrors one `get_billing_workspace_payments` row. */
function payment(
  overrides: Partial<Nullable<BillingWorkspacePaymentRow>> = {},
): BillingWorkspacePaymentRow {
  return {
    obligation_id: "obligation-1",
    organization_id: "org-1",
    purpose: "initial_admission",
    member_user_id: "user-1",
    member_name: "Pagamento Rejeitado",
    member_handle: "@seed_rejeitado",
    plan_type: "annual",
    amount: 36000,
    currency: "BRL",
    period_key: "initial",
    period_start: "2026-08-22",
    period_end: "2026-08-22",
    available_on: "2026-08-22",
    due_on: "2026-08-22",
    obligation_status: "available",
    effective_payment_state: "available",
    settled_at: null,
    latest_claim_id: "claim-1",
    latest_claim_status: null,
    latest_claim_created_at: "2026-08-23T01:02:00Z",
    latest_claim_decided_at: null,
    latest_claim_decision_reason: null,
    last_decision_actor_user_id: null,
    last_decision_actor_name: null,
    last_decision_at: null,
    claim_history: null,
    audit_history: null,
    ...overrides,
  } as unknown as BillingWorkspacePaymentRow;
}

function statusOf(payments: BillingWorkspacePaymentRow[]) {
  const { rows } = buildBillingWorkspaceMemberRows(
    [person],
    payments,
    "pt-BR",
  );
  return rows[0].periods[rows[0].history[0].periodKey]!.status;
}

test("a refused payment reads as rejected, not as awaiting payment", () => {
  assert.equal(
    statusOf([
      payment({
        effective_payment_state: "available",
        latest_claim_status: "rejected",
        latest_claim_decided_at: "2026-08-23T01:30:00Z",
        latest_claim_decision_reason: "Valor não identificado no extrato.",
      }),
    ]),
    "rejected",
  );
});

test("an obligation nobody has claimed still reads as awaiting payment", () => {
  assert.equal(
    statusOf([payment({ latest_claim_id: null, latest_claim_status: null })]),
    "awaiting_payment",
  );
});

test("the rejected chip clears itself once the person claims again", () => {
  // A new claim becomes the newest one, so the RPC reports `under_review` and
  // the refusal is no longer the latest word on the obligation.
  assert.equal(
    statusOf([
      payment({
        effective_payment_state: "under_review",
        latest_claim_id: "claim-2",
        latest_claim_status: "under_review",
      }),
    ]),
    "under_review",
  );
});

test("a missed due date outranks a refusal", () => {
  assert.equal(
    statusOf([
      payment({
        purpose: "recurring",
        effective_payment_state: "overdue",
        latest_claim_status: "rejected",
      }),
    ]),
    "overdue",
  );
});

test("an approved claim reads as paid", () => {
  assert.equal(
    statusOf([
      payment({
        effective_payment_state: "settled",
        latest_claim_status: "approved",
        settled_at: "2026-08-24T12:00:00Z",
      }),
    ]),
    "paid",
  );
});
