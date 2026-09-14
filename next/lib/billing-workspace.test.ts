import assert from "node:assert/strict";
import test from "node:test";

// Node's native TypeScript runner requires an explicit extension.
// @ts-expect-error TypeScript resolves the same source file for the web build.
import { normalizeDecisionReason } from "./billing-workspace.ts";
import type {
  ApproveInitialClaimResult,
  RejectInitialClaimResult,
} from "./initial-payment-claims";

/**
 * These type-level assertions are the guard on the decision contract itself.
 * They are inert at runtime and are enforced by `tsc --noEmit`: a compile error
 * here means the generated types drifted from the frozen RPC shapes, which is
 * how the retired subscription outputs would come back unnoticed.
 */
type AssertNever<T extends never> = T;

// `approve_initial_claim` admits the applicant and opens a contribution
// schedule. It must not report subscription state -- there are no subscriptions.
type _ApproveHasNoSubscriptionOutput = AssertNever<
  Extract<keyof ApproveInitialClaimResult, `subscription${string}`>
>;

type _ApproveReportsWhatItCreated = AssertNever<
  Exclude<
    | "assignment_id"
    | "audit_event_id"
    | "claim_id"
    | "claim_status"
    | "decision_applied_now"
    | "membership_user_id"
    | "obligation_id"
    | "obligation_status"
    | "schedule_id",
    keyof ApproveInitialClaimResult
  >
>;

// `reject_initial_claim` is the single refusal command: it refuses the
// application, rejects the claim, voids the obligation, and stores one reason.
type _RejectIsTheUnifiedRefusal = AssertNever<
  Exclude<
    | "application_id"
    | "application_status"
    | "audit_event_id"
    | "claim_id"
    | "claim_status"
    | "decision_applied_now"
    | "decision_reason"
    | "obligation_id"
    | "obligation_status",
    keyof RejectInitialClaimResult
  >
>;

type _RejectHasNoSubscriptionOutput = AssertNever<
  Extract<keyof RejectInitialClaimResult, `subscription${string}`>
>;

test("a refusal reason is normalized to the single form the command stores", () => {
  assert.equal(
    normalizeDecisionReason("  O   comprovante   não confere  "),
    "O comprovante não confere",
  );
});

test("whitespace alone is not a reason, so the refusal cannot be sent", () => {
  assert.equal(normalizeDecisionReason("   \n\t  "), null);
  assert.equal(normalizeDecisionReason(""), null);
  assert.equal(normalizeDecisionReason(undefined), null);
  assert.equal(normalizeDecisionReason(null), null);
});

test("an already normalized reason is passed through unchanged", () => {
  assert.equal(
    normalizeDecisionReason("Envie o comprovante completo"),
    "Envie o comprovante completo",
  );
});
