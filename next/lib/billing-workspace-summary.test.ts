import assert from "node:assert/strict";
import test from "node:test";

import type {
  FinancialStatus,
  MemberPeriod,
  MemberTableRow,
  PeriodKey,
} from "@/components/admin/member-ledger";

// Node's native TypeScript runner requires an explicit extension.
// @ts-expect-error TypeScript resolves the same source file for the web build.
import { summarizeFinancialAttention } from "./billing-workspace-summary.ts";

function period(
  periodKey: PeriodKey,
  status: FinancialStatus,
  amount: number | null = 2500,
): MemberPeriod {
  return {
    periodKey,
    periodLabel: periodKey,
    obligationId: `obligation-${periodKey}`,
    obligationKind: "recurring",
    status,
    amount,
    currency: "BRL",
    availableDate: `${periodKey}-03`,
    dueDate: `${periodKey}-10`,
    paidAt: null,
    claimId: null,
    claimStatus: null,
    claimCreatedAt: null,
    claimDecidedAt: null,
    claimReason: null,
    payerType: null,
    payerName: null,
    attentionReason: null,
    waiver: null,
  };
}

function row(id: string, history: MemberPeriod[]): MemberTableRow {
  return {
    id,
    name: id,
    handle: `@${id}`,
    role: "member",
    profilePicture: null,
    lifecycle: "active",
    plan: "monthly",
    joinedAt: null,
    lastVerifiedContributionAt: null,
    periods: Object.fromEntries(history.map((entry) => [entry.periodKey, entry])),
    history,
    // The most urgent period, as resolvePeriodRows picks it for "all".
    selectedPeriod: history[0],
  };
}

test("a person months behind counts once but owes every missed month", () => {
  const rows = [
    row("behind", [
      period("2026-09", "overdue"),
      period("2026-10", "overdue"),
      period("2026-11", "awaiting_payment"),
    ]),
    row("current", [period("2026-11", "awaiting_payment")]),
  ];

  const summary = summarizeFinancialAttention(rows, "all");
  const overdue = summary.find((entry) => entry.status === "overdue");
  const awaiting = summary.find((entry) => entry.status === "awaiting_payment");

  assert.deepEqual(overdue, {
    status: "overdue",
    people: 1,
    amount: 5000,
    currency: "BRL",
  });
  // The behind person's November charge stays with their overdue row; the
  // awaiting card matches the awaiting filter, which shows one person.
  assert.equal(awaiting?.people, 1);
  assert.equal(awaiting?.amount, 2500);
});

test("a selected month only adds up that month", () => {
  const behind = row("behind", [
    period("2026-09", "overdue"),
    period("2026-10", "overdue"),
  ]);
  const rows = [{ ...behind, selectedPeriod: behind.periods["2026-10"]! }];

  const overdue = summarizeFinancialAttention(rows, "2026-10").find(
    (entry) => entry.status === "overdue",
  );

  assert.equal(overdue?.people, 1);
  assert.equal(overdue?.amount, 2500);
});

test("a void period carries no amount and an empty ledger sums to zero", () => {
  assert.equal(
    summarizeFinancialAttention(
      [row("void", [period("2026-10", "overdue", null)])],
      "all",
    )[0]?.amount,
    0,
  );
  assert.ok(
    summarizeFinancialAttention([], "all").every(
      (entry) => entry.people === 0 && entry.amount === 0,
    ),
  );
});

test("a waived month is not owed and adds nothing to any total", () => {
  const summary = summarizeFinancialAttention(
    [
      row("forgiven", [
        period("2026-10", "overdue"),
        period("2026-09", "waived"),
      ]),
    ],
    "all",
  );

  assert.equal(
    summary.find((entry) => entry.status === "overdue")?.amount,
    2500,
  );
  assert.ok(summary.every((entry) => (entry.status as string) !== "waived"));
});
