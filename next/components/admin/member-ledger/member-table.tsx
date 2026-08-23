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
import { useCallback, useMemo, useState } from "react";

import type {
  FinancialFilter,
  FinancialStatus,
  LifecycleFilter,
  MemberPeriod,
  MemberRow,
  MemberTableController,
  MemberTableRow,
  PeriodKey,
} from "./types";

const DEFAULT_PERIOD_KEY = "2000-01" as PeriodKey;

const DEFAULT_LIFECYCLE_OPTIONS = [
  { value: "all", label: "All lifecycle states" },
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
  { value: "no_obligation", label: "No obligation" },
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
  lastPaid: string;
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
    lastPaid: "Last paid",
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
      sortUndefined: "last",
    },
    {
      id: "paidAt",
      accessorFn: (row) => row.selectedPeriod.paidAt,
      header: resolvedLabels.lastPaid,
      sortUndefined: "last",
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
  initialPeriodKey?: PeriodKey;
  initialPageSize?: number;
  initialColumnVisibility?: VisibilityState;
};

function resolvePeriodRows(
  data: MemberRow[],
  periodKey: PeriodKey,
  periodOptions: ReadonlyArray<{ key: PeriodKey; label: string }>,
) {
  return data.map<MemberTableRow>((row) => ({
    ...row,
    selectedPeriod:
      row.periods[periodKey] ?? noObligationFor(periodKey, periodOptions),
  }));
}

export function useMemberTable({
  columns = memberColumns,
  data = [],
  financialOptions = DEFAULT_FINANCIAL_OPTIONS,
  initialColumnVisibility,
  initialPageSize = 8,
  initialPeriodKey = DEFAULT_PERIOD_KEY,
  lifecycleOptions = DEFAULT_LIFECYCLE_OPTIONS,
  periodOptions = [],
}: UseMemberTableOptions = {}): MemberTableController {
  const [search, setSearchState] = useState("");
  const [lifecycle, setLifecycleState] = useState<LifecycleFilter>("all");
  const [financial, setFinancialState] = useState<FinancialFilter>("all");
  const [periodKey, setPeriodKeyState] = useState<PeriodKey>(initialPeriodKey);
  const [sorting, setSorting] = useState<SortingState>([
    { id: "financialStatus", desc: false },
    { id: "dueDate", desc: false },
  ]);
  const [rowSelection, setRowSelection] = useState({});
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(
    initialColumnVisibility ?? {},
  );
  const [selectedRowId, setSelectedRowId] = useState<string | null>(null);

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
      onGlobalFilterChange: (value) => setSearchState(String(value ?? "")),
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
    [columnVisibility, columns, filteredRows, initialPageSize, rowSelection, search, sorting],
  );

  const table = useReactTable(tableOptions);

  const setSearch = useCallback(
    (value: string) => {
      setSearchState(value);
      table.setPageIndex(0);
    },
    [table],
  );

  const setLifecycleFilter = useCallback(
    (value: LifecycleFilter) => {
      setLifecycleState(value);
      table.setPageIndex(0);
    },
    [table],
  );

  const setFinancialFilter = useCallback(
    (value: FinancialFilter) => {
      setFinancialState(value);
      table.setPageIndex(0);
    },
    [table],
  );

  const setPeriodKey = useCallback(
    (value: PeriodKey) => {
      setPeriodKeyState(value);
      table.setPageIndex(0);
    },
    [table],
  );

  const resetFilters = useCallback(() => {
    setSearchState("");
    setLifecycleState("all");
    setFinancialState("all");
    setPeriodKeyState(initialPeriodKey);
    setSelectedRowId(null);
    table.setPageIndex(0);
  }, [initialPeriodKey, table]);

  return {
    table,
    filters: { search, lifecycle, financial, periodKey },
    counts,
    periodOptions,
    lifecycleOptions,
    financialOptions,
    selectedRow:
      selectedRowId === null
        ? null
        : table.getRowModel().rows.find((row) => row.id === selectedRowId) ?? null,
    setSearch,
    setLifecycleFilter,
    setFinancialFilter,
    setPeriodKey,
    setSelectedRowId,
    resetFilters,
  };
}
