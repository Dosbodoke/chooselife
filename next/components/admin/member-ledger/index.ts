export {
  createMemberColumns,
  type MemberColumnLabels,
  memberColumns,
  memberLedgerParsers,
  parseAsPeriodFilter,
  resolvePeriodRows,
  useMemberTable,
  type UseMemberTableOptions,
} from "./member-table";
export type {
  ClaimStatus,
  FinancialFilter,
  FinancialStatus,
  LifecycleFilter,
  LifecycleStatus,
  MemberPeriod,
  MemberRow,
  MemberTableController,
  MemberTableCounts,
  MemberTableFilters,
  MemberTableRow,
  ObligationKind,
  PeriodFilter,
  PeriodKey,
  PeriodWaiver,
} from "./types";

export function formatCurrency(
  amount: number | null,
  currency = "BRL",
  locale = "pt-BR",
) {
  if (amount === null) return "—";

  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
  }).format(amount / 100);
}

export function formatDate(value: string | null, locale = "pt-BR") {
  if (!value) return "—";

  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(`${value.slice(0, 10)}T00:00:00`));
}

/**
 * "September 2026" for a due date. A calendar month has no time zone, so it is
 * read and printed in UTC: the server and every browser agree on the month.
 */
export function formatMonth(value: string, locale = "pt-BR") {
  return new Intl.DateTimeFormat(locale, {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value.slice(0, 7)}-01T00:00:00Z`));
}

export function formatDateTime(value: string | null, locale = "pt-BR") {
  if (!value) return "—";

  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(value));
}
