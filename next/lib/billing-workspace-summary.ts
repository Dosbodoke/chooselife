import type {
  FinancialStatus,
  MemberPeriod,
  MemberTableRow,
  PeriodFilter,
} from "@/components/admin/member-ledger";

/** The states an admin can act on, in the order the summary shows them. */
export const ATTENTION_STATUSES = [
  "overdue",
  "rejected",
  "awaiting_payment",
  "under_review",
] as const satisfies readonly FinancialStatus[];

export type AttentionStatus = (typeof ATTENTION_STATUSES)[number];

export type AttentionSummary = {
  status: AttentionStatus;
  /** People whose row shows this status, so it matches the filter's result. */
  people: number;
  /** Everything those people owe in this status, not just the row's period. */
  amount: number;
  currency: string;
};

function periodsInScope(row: MemberTableRow, periodKey: PeriodFilter) {
  if (periodKey === "all") return row.history;

  const period = row.periods[periodKey];
  return period ? [period] : [];
}

function sumAmounts(periods: MemberPeriod[]) {
  return periods.reduce((total, period) => total + (period.amount ?? 0), 0);
}

/**
 * Counts people the way the financial filter does -- by the status their row
 * shows -- so clicking a summary lands on exactly that many rows.
 *
 * The amount is wider than the row: a person three months behind shows one
 * overdue row but owes all three, and the admin chasing them needs the whole
 * figure.
 */
export function summarizeFinancialAttention(
  rows: MemberTableRow[],
  periodKey: PeriodFilter,
): AttentionSummary[] {
  return ATTENTION_STATUSES.map((status) => {
    const matching = rows.filter((row) => row.selectedPeriod.status === status);
    const periods = matching.flatMap((row) =>
      periodsInScope(row, periodKey).filter((period) => period.status === status),
    );

    return {
      status,
      people: matching.length,
      amount: sumAmounts(periods),
      currency: periods[0]?.currency ?? matching[0]?.selectedPeriod.currency ?? "BRL",
    };
  });
}
