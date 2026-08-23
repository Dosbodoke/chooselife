"use client";

import { flexRender } from "@tanstack/react-table";
import {
  ArrowDownUp,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useMemo } from "react";

import {
  createMemberColumns,
  type FinancialFilter,
  type FinancialStatus,
  formatCurrency,
  formatDate,
  formatDateTime,
  type LifecycleFilter,
  type LifecycleStatus,
  type MemberRow,
  type MemberTableRow,
  type PeriodKey,
  useMemberTable,
} from "@/components/admin/member-ledger";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

function sortIcon(sorted: false | "asc" | "desc") {
  if (sorted === "asc") return <span aria-hidden="true">↑</span>;
  if (sorted === "desc") return <span aria-hidden="true">↓</span>;
  return <ArrowDownUp className="size-3.5 opacity-40" aria-hidden="true" />;
}

function statusTone(status: FinancialStatus) {
  if (status === "paid") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "overdue") return "border-red-200 bg-red-50 text-red-700";
  if (status === "under_review") return "border-amber-200 bg-amber-50 text-amber-800";
  if (status === "awaiting_payment") return "border-orange-200 bg-orange-50 text-orange-800";
  if (status === "scheduled") return "border-blue-200 bg-blue-50 text-blue-700";
  return "border-slate-200 bg-slate-50 text-slate-600";
}

function lifecycleTone(status: LifecycleStatus) {
  if (status === "active") return "border-slate-200 bg-white text-slate-700";
  if (status === "applicant") return "border-violet-200 bg-violet-50 text-violet-700";
  return "border-dashed border-slate-300 bg-slate-50 text-slate-500";
}

type BillingWorkspaceLedgerProps = {
  data: MemberRow[];
  periodOptions: ReadonlyArray<{ key: PeriodKey; label: string }>;
  onOpenMember: (member: MemberTableRow) => void;
};

export default function BillingWorkspaceLedger({
  data,
  onOpenMember,
  periodOptions,
}: BillingWorkspaceLedgerProps) {
  const locale = useLocale();
  const displayLocale = locale.toLowerCase().startsWith("pt") ? "pt-BR" : "en-US";
  const t = useTranslations("admin");
  const columns = useMemo(
    () =>
      createMemberColumns({
        amount: t("ledger.columns.amount"),
        due: t("ledger.columns.due"),
        lastPaid: t("ledger.columns.lastPaid"),
        lifecycle: t("ledger.columns.lifecycle"),
        periodStatus: t("ledger.columns.periodStatus"),
        person: t("ledger.columns.person"),
        plan: t("ledger.columns.plan"),
      }),
    [t],
  );
  const model = useMemberTable({
    columns,
    data,
    initialPageSize: 10,
    initialPeriodKey: periodOptions[0]?.key,
    periodOptions,
  });
  const periodLabel =
    model.periodOptions.find((period) => period.key === model.filters.periodKey)?.label ??
    model.filters.periodKey;
  const lifecycleLabels: Record<LifecycleStatus, string> = {
    active: t("ledger.lifecycle.active"),
    applicant: t("ledger.lifecycle.applicant"),
    draft: t("ledger.lifecycle.draft"),
  };
  const financialLabels: Record<FinancialStatus, string> = {
    awaiting_payment: t("ledger.financial.awaitingPayment"),
    no_obligation: t("ledger.financial.noObligation"),
    overdue: t("ledger.financial.overdue"),
    paid: t("ledger.financial.paid"),
    scheduled: t("ledger.financial.scheduled"),
    under_review: t("ledger.financial.underReview"),
  };

  const renderCell = (row: MemberTableRow, columnId: string) => {
    const period = row.selectedPeriod;

    if (columnId === "name") {
      return (
        <div className="flex min-w-[220px] items-center gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm font-semibold text-slate-600">
            {row.name
              .split(" ")
              .map((part) => part[0])
              .slice(0, 2)
              .join("") || "?"}
          </div>
          <div className="min-w-0">
            <p className="truncate font-semibold text-slate-900">
              {row.name || t("common.unnamedMember")}
            </p>
            <p className="truncate text-xs text-slate-500">
              {row.handle || t("common.noHandle")}
            </p>
          </div>
        </div>
      );
    }

    if (columnId === "lifecycle") {
      return (
        <Badge variant="outline" className={lifecycleTone(row.lifecycle)}>
          {lifecycleLabels[row.lifecycle]}
        </Badge>
      );
    }

    if (columnId === "financialStatus") {
      return (
        <Badge
          variant="outline"
          className={`whitespace-nowrap ${statusTone(period.status)}`}
        >
          <span className="mr-1.5 size-1.5 rounded-full bg-current" aria-hidden="true" />
          {financialLabels[period.status]}
        </Badge>
      );
    }

    if (columnId === "plan") {
      return row.plan ? (
        <span className="capitalize text-slate-700">
          {row.plan === "annual" ? t("plans.annual") : t("plans.monthly")}
        </span>
      ) : (
        <span className="text-slate-400">—</span>
      );
    }

    if (columnId === "amount") {
      return (
        <span className="font-medium tabular-nums text-slate-800">
          {formatCurrency(period.amount, period.currency, displayLocale)}
        </span>
      );
    }

    if (columnId === "dueDate") {
      return (
        <span className="whitespace-nowrap text-slate-600">
          {formatDate(period.dueDate, displayLocale)}
        </span>
      );
    }

    if (columnId === "paidAt") {
      return (
        <span className="whitespace-nowrap text-slate-600">
          {formatDateTime(period.paidAt, displayLocale)}
        </span>
      );
    }

    return <span>{String(row[columnId as keyof MemberTableRow] ?? "—")}</span>;
  };

  return (
    <section
      aria-labelledby="billing-ledger-title"
      className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_18px_50px_-38px_rgba(15,23,42,0.55)]"
    >
      <div className="border-b border-slate-200 px-5 py-5 md:px-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">
              <CalendarDays className="size-3.5" aria-hidden="true" />
              {t("ledger.eyebrow")}
            </div>
            <h1 id="billing-ledger-title" className="mt-2 text-xl font-semibold tracking-tight text-slate-950">
              {t("ledger.title")}
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              {t("ledger.description", { period: periodLabel })}
            </p>
          </div>
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <span className="rounded-full bg-slate-100 px-3 py-1.5 font-medium text-slate-700">
              {t("ledger.peopleCount", { count: model.counts.total })}
            </span>
            <span className="rounded-full bg-orange-50 px-3 py-1.5 font-medium text-orange-800">
              {t("ledger.notPaidCount", { count: model.counts.notPaid })}
            </span>
          </div>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-[minmax(220px,1.5fr)_repeat(3,minmax(150px,1fr))]">
          <label className="relative block">
            <span className="sr-only">{t("ledger.searchLabel")}</span>
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400"
              aria-hidden="true"
            />
            <Input
              value={model.filters.search}
              onChange={(event) => model.setSearch(event.target.value)}
              placeholder={t("ledger.searchPlaceholder")}
              className="h-10 rounded-xl border-slate-200 pl-9"
            />
          </label>
          <FilterSelect
            ariaLabel={t("ledger.periodLabel")}
            value={model.filters.periodKey}
            onChange={(value) => model.setPeriodKey(value as PeriodKey)}
            options={model.periodOptions.map((option) => ({
              value: option.key,
              label: option.label,
            }))}
            icon={<CalendarDays className="size-3.5" aria-hidden="true" />}
          />
          <FilterSelect
            ariaLabel={t("ledger.lifecycleLabel")}
            value={model.filters.lifecycle}
            onChange={(value) => model.setLifecycleFilter(value as LifecycleFilter)}
            options={[
              { value: "all", label: t("ledger.lifecycle.all") },
              { value: "active", label: t("ledger.lifecycle.activePlural") },
              { value: "applicant", label: t("ledger.lifecycle.applicants") },
              { value: "draft", label: t("ledger.lifecycle.drafts") },
            ]}
          />
          <FilterSelect
            ariaLabel={t("ledger.financialLabel")}
            value={model.filters.financial}
            onChange={(value) => model.setFinancialFilter(value as FinancialFilter)}
            options={[
              { value: "all", label: t("ledger.financial.all") },
              { value: "not_paid", label: t("ledger.financial.notPaid") },
              { value: "overdue", label: t("ledger.financial.overdue") },
              { value: "under_review", label: t("ledger.financial.underReview") },
              { value: "awaiting_payment", label: t("ledger.financial.awaitingPayment") },
              { value: "scheduled", label: t("ledger.financial.scheduled") },
              { value: "paid", label: t("ledger.financial.paid") },
              { value: "no_obligation", label: t("ledger.financial.noObligation") },
            ]}
            icon={<SlidersHorizontal className="size-3.5" aria-hidden="true" />}
          />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-[1050px] w-full border-collapse text-left text-sm">
          <caption className="sr-only">{t("ledger.tableLabel")}</caption>
          <thead className="bg-slate-50 text-xs uppercase tracking-[0.08em] text-slate-500">
            {model.table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className="border-b border-slate-200 px-5 py-3 font-semibold md:px-6"
                  >
                    {header.isPlaceholder ? null : (
                      <button
                        type="button"
                        className="inline-flex items-center gap-2 whitespace-nowrap outline-none focus-visible:rounded focus-visible:ring-2 focus-visible:ring-ring"
                        onClick={header.column.getToggleSortingHandler()}
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {sortIcon(header.column.getIsSorted())}
                      </button>
                    )}
                  </th>
                ))}
                <th className="border-b border-slate-200 px-5 py-3 font-semibold md:px-6">
                  {t("ledger.columns.action")}
                </th>
              </tr>
            ))}
          </thead>
          <tbody className="divide-y divide-slate-100">
            {model.table.getRowModel().rows.length > 0 ? (
              model.table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  className="cursor-pointer bg-white transition-colors hover:bg-slate-50"
                  onClick={() => onOpenMember(row.original)}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="whitespace-nowrap px-5 py-4 align-middle md:px-6">
                      {renderCell(row.original, cell.column.id)}
                    </td>
                  ))}
                  <td className="px-5 py-4 md:px-6">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 rounded-lg px-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                      onClick={(event) => {
                        event.stopPropagation();
                        onOpenMember(row.original);
                      }}
                    >
                      {t("ledger.review")}
                      <ChevronRight className="ml-1 size-3.5" aria-hidden="true" />
                    </Button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={8} className="px-6 py-16 text-center">
                  <p className="font-semibold text-slate-900">
                    {t("ledger.emptyTitle")}
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    {t("ledger.emptyDescription")}
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mt-4 rounded-lg"
                    onClick={model.resetFilters}
                  >
                    {t("ledger.resetFilters")}
                  </Button>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col gap-3 border-t border-slate-200 px-5 py-4 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between md:px-6">
        <span>
          {t("ledger.showing", {
            shown: model.table.getRowModel().rows.length,
            total: model.table.getFilteredRowModel().rows.length,
          })}
        </span>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-8 rounded-lg"
            onClick={() => model.table.previousPage()}
            disabled={!model.table.getCanPreviousPage()}
            aria-label={t("ledger.previousPage")}
          >
            <ChevronLeft className="size-4" aria-hidden="true" />
          </Button>
          <span className="min-w-16 text-center text-xs font-medium tabular-nums text-slate-600">
            {model.table.getState().pagination.pageIndex + 1} / {Math.max(model.table.getPageCount(), 1)}
          </span>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-8 rounded-lg"
            onClick={() => model.table.nextPage()}
            disabled={!model.table.getCanNextPage()}
            aria-label={t("ledger.nextPage")}
          >
            <ChevronRight className="size-4" aria-hidden="true" />
          </Button>
        </div>
      </div>
    </section>
  );
}

function FilterSelect({
  ariaLabel,
  icon,
  onChange,
  options,
  value,
}: {
  ariaLabel: string;
  icon?: React.ReactNode;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  value: string;
}) {
  return (
    <label className="relative block">
      <span className="sr-only">{ariaLabel}</span>
      {icon ? (
        <span className="pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 text-slate-400">
          {icon}
        </span>
      ) : null}
      <select
        aria-label={ariaLabel}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={`h-10 w-full appearance-none rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-ring ${icon ? "pl-9" : ""}`}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
