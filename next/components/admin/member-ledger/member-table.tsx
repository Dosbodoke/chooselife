"use client";

import {
  type ColumnDef,
  type FilterFn,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  type SortingFn,
  type SortingState,
  type TableOptions,
  useReactTable,
  type VisibilityState,
} from "@tanstack/react-table";
import {
  createParser,
  parseAsString,
  parseAsStringLiteral,
  useQueryState,
  useQueryStates,
} from "nuqs";
import { useCallback, useMemo, useState } from "react";

import type {
  FinancialFilter,
  FinancialStatus,
  LifecycleFilter,
  MemberPeriod,
  MemberRow,
  MemberTableController,
  MemberTableRow,
  PeriodFilter,
  PeriodKey,
} from "./types";

const DEFAULT_PERIOD_FILTER: PeriodFilter = "all";

const LIFECYCLE_VALUES = [
  "all",
  "draft",
  "applicant",
  "active",
] as const satisfies readonly LifecycleFilter[];

const FINANCIAL_VALUES = [
  "all",
  "not_paid",
  "paid",
  "under_review",
  "awaiting_payment",
  "overdue",
  "scheduled",
  "no_obligation",
] as const satisfies readonly FinancialFilter[];

const PERIOD_KEY_PATTERN = /^\d{4}-\d{2}$/;

/** A period is a `YYYY-MM` key; anything else is rejected so a mangled link
 * falls back to the default instead of emptying the table. */
export const parseAsPeriodFilter = createParser<PeriodFilter>({
  parse: (value) => {
    if (value === "all") return "all";
    return PERIOD_KEY_PATTERN.test(value) ? (value as PeriodKey) : null;
  },
  serialize: (value) => value,
});

/**
 * The ledger view lives entirely in the URL: an admin can paste "who is overdue
 * this month, with Ana open" into a message and the person opening it lands on
 * exactly that screen.
 */
export const memberLedgerParsers = {
  q: parseAsString.withDefault(""),
  lifecycle: parseAsStringLiteral(LIFECYCLE_VALUES).withDefault("all"),
  financial: parseAsStringLiteral(FINANCIAL_VALUES).withDefault("all"),
  period: parseAsPeriodFilter.withDefault(DEFAULT_PERIOD_FILTER),
  /** The focused drawer. Pushed, so Back closes the drawer instead of leaving the page. */
  member: parseAsString.withOptions({ history: "push", scroll: false }),
};

const DEFAULT_LIFECYCLE_OPTIONS = [
  { value: "all", label: "All registrations" },
  { value: "active", label: "Active members" },
  { value: "applicant", label: "Applicants" },
  { value: "draft", label: "Drafts" },
] as const;

const DEFAULT_FINANCIAL_OPTIONS = [
  { value: "all", label: "All financial states" },
  { value: "not_paid", label: "Not paid this period" },
  { value: "overdue", label: "Overdue" },
  { value: "under_review", label: "Under review" },
  { value: "awaiting_payment", label: "Awaiting payment" },
  { value: "scheduled", label: "Scheduled" },
  { value: "paid", label: "Paid" },
  { value: "no_obligation", label: "No charge" },
] as const;

const financialRank: Record<FinancialStatus, number> = {
  overdue: 0,
  under_review: 1,
  awaiting_payment: 2,
  scheduled: 3,
  paid: 4,
  no_obligation: 5,
};

const financialSorting: SortingFn<MemberTableRow> = (left, right) =>
  financialRank[left.original.selectedPeriod.status] -
  financialRank[right.original.selectedPeriod.status];

/** A row with no charge has no due date, so it sinks instead of leading the asc sort. */
const dueDateSorting: SortingFn<MemberTableRow> = (left, right) => {
  const leftDue = left.original.selectedPeriod.dueDate;
  const rightDue = right.original.selectedPeriod.dueDate;
  if (!leftDue && !rightDue) return 0;
  if (!leftDue) return 1;
  if (!rightDue) return -1;
  return leftDue.localeCompare(rightDue);
};

const globalFilter: FilterFn<MemberTableRow> = (row, _columnId, value) => {
  const search = String(value).trim().toLocaleLowerCase();
  if (!search) return true;

  const original = row.original;
  return [
    original.name,
    original.handle,
    original.role,
    original.lifecycle,
    original.plan,
    original.selectedPeriod.periodLabel,
    original.selectedPeriod.status,
    original.selectedPeriod.attentionReason,
  ]
    .filter(Boolean)
    .some((field) => String(field).toLocaleLowerCase().includes(search));
};

function noObligationFor(
  periodKey: PeriodKey,
  periodOptions: ReadonlyArray<{ key: PeriodKey; label: string }>,
): MemberPeriod {
  return {
    periodKey,
    periodLabel:
      periodOptions.find((option) => option.key === periodKey)?.label ?? periodKey,
    obligationId: null,
    obligationKind: null,
    status: "no_obligation",
    amount: null,
    currency: "BRL",
    availableDate: null,
    dueDate: null,
    paidAt: null,
    claimId: null,
    claimStatus: null,
    claimCreatedAt: null,
    claimDecidedAt: null,
    claimReason: null,
    payerType: null,
    payerName: null,
    attentionReason: null,
  };
}

export type MemberColumnLabels = {
  amount: string;
  due: string;
  lifecycle: string;
  periodStatus: string;
  person: string;
  plan: string;
};

export function createMemberColumns(
  labels: Partial<MemberColumnLabels> = {},
): ColumnDef<MemberTableRow>[] {
  const resolvedLabels: MemberColumnLabels = {
    amount: "Amount",
    due: "Due",
    lifecycle: "Lifecycle",
    periodStatus: "Period status",
    person: "Person",
    plan: "Plan",
    ...labels,
  };

  return [
    { accessorKey: "name", header: resolvedLabels.person },
    { accessorKey: "lifecycle", header: resolvedLabels.lifecycle },
    {
      id: "financialStatus",
      accessorFn: (row) => row.selectedPeriod.status,
      header: resolvedLabels.periodStatus,
      sortingFn: financialSorting,
    },
    { accessorKey: "plan", header: resolvedLabels.plan },
    {
      id: "amount",
      accessorFn: (row) => row.selectedPeriod.amount,
      header: resolvedLabels.amount,
      sortUndefined: "last",
    },
    {
      id: "dueDate",
      accessorFn: (row) => row.selectedPeriod.dueDate,
      header: resolvedLabels.due,
      sortingFn: dueDateSorting,
    },
  ];
}

export const memberColumns = createMemberColumns();

export type UseMemberTableOptions = {
  data?: MemberRow[];
  columns?: ColumnDef<MemberTableRow>[];
  periodOptions?: ReadonlyArray<{ key: PeriodKey; label: string }>;
  lifecycleOptions?: ReadonlyArray<{
    value: LifecycleFilter;
    label: string;
  }>;
  financialOptions?: ReadonlyArray<{
    value: FinancialFilter;
    label: string;
  }>;
  initialPeriodKey?: PeriodFilter;
  initialPageSize?: number;
  initialColumnVisibility?: VisibilityState;
};

/**
 * With no month selected the row still has to show a single charge, so it shows
 * the one an admin would act on: the most urgent unsettled period, earliest due
 * first. A member who owes nothing falls back to their latest period, which is
 * how a fully paid row still reads as "paid" instead of "no charge".
 */
function mostUrgentPeriod(row: MemberRow): MemberPeriod | undefined {
  const ranked = [...row.history].sort(
    (left, right) =>
      financialRank[left.status] - financialRank[right.status] ||
      (left.dueDate ?? "").localeCompare(right.dueDate ?? ""),
  );

  return ranked[0];
}

export function resolvePeriodRows(
  data: MemberRow[],
  periodKey: PeriodFilter,
  periodOptions: ReadonlyArray<{ key: PeriodKey; label: string }>,
) {
  return data.map<MemberTableRow>((row) => ({
    ...row,
    selectedPeriod:
      (periodKey === "all" ? mostUrgentPeriod(row) : row.periods[periodKey]) ??
      noObligationFor(
        periodKey === "all" ? currentPeriodKeyOf(periodOptions) : periodKey,
        periodOptions,
      ),
  }));
}

function currentPeriodKeyOf(
  periodOptions: ReadonlyArray<{ key: PeriodKey; label: string }>,
): PeriodKey {
  return periodOptions[0]?.key ?? ("2000-01" as PeriodKey);
}

export function useMemberTable({
  columns = memberColumns,
  data = [],
  financialOptions = DEFAULT_FINANCIAL_OPTIONS,
  initialColumnVisibility,
  initialPageSize = 8,
  initialPeriodKey = DEFAULT_PERIOD_FILTER,
  lifecycleOptions = DEFAULT_LIFECYCLE_OPTIONS,
  periodOptions = [],
}: UseMemberTableOptions = {}): MemberTableController {
  const filterParsers = useMemo(
    () => ({
      q: memberLedgerParsers.q,
      lifecycle: memberLedgerParsers.lifecycle,
      financial: memberLedgerParsers.financial,
      period: parseAsPeriodFilter.withDefault(initialPeriodKey),
    }),
    [initialPeriodKey],
  );

  // Filters replace rather than push: typing in the search box should not bury
  // the page under a stack of history entries.
  const [
    { q: search, lifecycle, financial, period: periodKey },
    setFilters,
  ] = useQueryStates(filterParsers, { history: "replace", scroll: false });

  const [selectedRowId, setSelectedRowIdState] = useQueryState(
    "member",
    memberLedgerParsers.member,
  );

  // Sorting and column layout are how one admin reads the table, not what they
  // are looking at, so they stay out of a link meant to be shared.
  const [sorting, setSorting] = useState<SortingState>([
    // Due date leads: the ledger is read as "what is coming up / already late".
    { id: "dueDate", desc: false },
    { id: "financialStatus", desc: false },
  ]);
  const [rowSelection, setRowSelection] = useState({});
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(
    initialColumnVisibility ?? {},
  );

  const periodRows = useMemo(
    () => resolvePeriodRows(data, periodKey, periodOptions),
    [data, periodKey, periodOptions],
  );

  const filteredRows = useMemo(
    () =>
      periodRows.filter((row) => {
        if (lifecycle !== "all" && row.lifecycle !== lifecycle) return false;
        const notPaid = ["under_review", "awaiting_payment", "overdue"].includes(
          row.selectedPeriod.status,
        );
        if (financial === "not_paid" && !notPaid) return false;
        if (
          financial !== "all" &&
          financial !== "not_paid" &&
          row.selectedPeriod.status !== financial
        ) {
          return false;
        }
        return true;
      }),
    [financial, lifecycle, periodRows],
  );

  const counts = useMemo(() => {
    const attentionStatuses: FinancialStatus[] = [
      "under_review",
      "awaiting_payment",
      "overdue",
    ];

    return {
      total: periodRows.length,
      attention: periodRows.filter((row) =>
        attentionStatuses.includes(row.selectedPeriod.status),
      ).length,
      paid: periodRows.filter((row) => row.selectedPeriod.status === "paid")
        .length,
      notPaid: periodRows.filter((row) =>
        attentionStatuses.includes(row.selectedPeriod.status),
      ).length,
      active: periodRows.filter((row) => row.lifecycle === "active").length,
      applicants: periodRows.filter((row) => row.lifecycle === "applicant")
        .length,
      drafts: periodRows.filter((row) => row.lifecycle === "draft").length,
    };
  }, [periodRows]);

  const tableOptions = useMemo<TableOptions<MemberTableRow>>(
    () => ({
      data: filteredRows,
      columns,
      state: {
        globalFilter: search,
        sorting,
        rowSelection,
        columnVisibility,
      },
      globalFilterFn: globalFilter,
      enableRowSelection: true,
      onGlobalFilterChange: (value) => {
        void setFilters({ q: String(value ?? "") });
      },
      onSortingChange: setSorting,
      onRowSelectionChange: setRowSelection,
      onColumnVisibilityChange: setColumnVisibility,
      getRowId: (row) => row.id,
      getCoreRowModel: getCoreRowModel(),
      getFilteredRowModel: getFilteredRowModel(),
      getSortedRowModel: getSortedRowModel(),
      getPaginationRowModel: getPaginationRowModel(),
      initialState: {
        pagination: { pageSize: initialPageSize, pageIndex: 0 },
      },
    }),
    [
      columnVisibility,
      columns,
      filteredRows,
      initialPageSize,
      rowSelection,
      search,
      setFilters,
      sorting,
    ],
  );

  const table = useReactTable(tableOptions);

  const setSearch = useCallback(
    (value: string) => {
      void setFilters({ q: value });
      table.setPageIndex(0);
    },
    [setFilters, table],
  );

  const setLifecycleFilter = useCallback(
    (value: LifecycleFilter) => {
      void setFilters({ lifecycle: value });
      table.setPageIndex(0);
    },
    [setFilters, table],
  );

  const setFinancialFilter = useCallback(
    (value: FinancialFilter) => {
      void setFilters({ financial: value });
      table.setPageIndex(0);
    },
    [setFilters, table],
  );

  const setPeriodKey = useCallback(
    (value: PeriodFilter) => {
      void setFilters({ period: value });
      table.setPageIndex(0);
    },
    [setFilters, table],
  );

  const setSelectedRowId = useCallback(
    (value: string | null) => {
      void setSelectedRowIdState(value);
    },
    [setSelectedRowIdState],
  );

  const resetFilters = useCallback(() => {
    // `null` clears every key this hook owns, so the shared link collapses back
    // to a bare `/admin` instead of carrying default values around.
    void setFilters(null);
    void setSelectedRowIdState(null);
    table.setPageIndex(0);
  }, [setFilters, setSelectedRowIdState, table]);

  return {
    table,
    filters: { search, lifecycle, financial, periodKey },
    counts,
    periodOptions,
    lifecycleOptions,
    financialOptions,
    selectedRowId,
    // Resolved from every row, not just the visible page: a link to a member who
    // sits behind a filter or on page three still opens on that member.
    selectedMember:
      periodRows.find((row) => row.id === selectedRowId) ?? null,
    setSearch,
    setLifecycleFilter,
    setFinancialFilter,
    setPeriodKey,
    setSelectedRowId,
    resetFilters,
  };
}
