import assert from "node:assert/strict";
import test from "node:test";

import type { BillingWorkspacePaymentRow } from "./billing-workspace";
import {
  normalizeWaiverReason,
  selectedCharges,
  sumCharges,
  waivableCharges,
  waiverFailure,
  // Node's native TypeScript runner requires an explicit extension.
  // @ts-expect-error TypeScript resolves the same source file for the web build.
} from "./contribution-waiver.ts";

function payment(
  overrides: Partial<BillingWorkspacePaymentRow>,
): BillingWorkspacePaymentRow {
  return {
    obligation_id: "obligation-1",
    member_user_id: "user-1",
    purpose: "recurring",
    period_key: "2026-09",
    due_on: "2026-09-10",
    amount: 2500,
    currency: "BRL",
    effective_payment_state: "overdue",
    ...overrides,
  } as BillingWorkspacePaymentRow;
}

const payments = [
  payment({ obligation_id: "oct", period_key: "2026-10", due_on: "2026-10-10" }),
  payment({ obligation_id: "sep", period_key: "2026-09", due_on: "2026-09-10" }),
  payment({ obligation_id: "paid", effective_payment_state: "settled" }),
  payment({ obligation_id: "review", effective_payment_state: "under_review" }),
  payment({ obligation_id: "void", effective_payment_state: "void" }),
  payment({ obligation_id: "next", effective_payment_state: "available" }),
  payment({ obligation_id: "admission", purpose: "initial_admission" }),
  payment({ obligation_id: "other", member_user_id: "user-2" }),
];

test("only this person's overdue recurring months are offered, oldest first", () => {
  assert.deepEqual(
    waivableCharges(payments, "user-1").map((charge) => charge.obligationId),
    ["sep", "oct"],
  );
});

test("a selected month that stopped being waivable drops out of the review", () => {
  const charges = waivableCharges(payments, "user-1");
  const selected = selectedCharges(charges, new Set(["sep", "paid"]));

  assert.deepEqual(
    selected.map((charge) => charge.obligationId),
    ["sep"],
  );
  assert.equal(sumCharges(selected), 2500);
});

test("the reason is normalized the way the audit stores it", () => {
  assert.equal(
    normalizeWaiverReason("  Dificuldade \n financeira  "),
    "Dificuldade financeira",
  );
  assert.equal(normalizeWaiverReason("   "), null);
});

test("refusals map to their reason and anything else is unknown", () => {
  assert.equal(waiverFailure({ code: "40001", hint: "under_review" }), "under_review");
  assert.equal(waiverFailure({ code: "22023", hint: "reason_required" }), "reason_required");
  assert.equal(waiverFailure({ code: "42501" }), "unauthorized");
  assert.equal(waiverFailure({ code: "PGRST000" }), "unknown");
  assert.equal(waiverFailure({}), "unknown");
});
