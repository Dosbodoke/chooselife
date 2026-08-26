"use client";

import { flexRender } from "@tanstack/react-table";
import {
  ArrowDownUp,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Search,
  SlidersHorizontal,
  Users,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { useMemo } from "react";

import {
  createMemberColumns,
  type FinancialFilter,
  type FinancialStatus,
  formatCurrency,
  formatDate,
  type LifecycleFilter,
  type LifecycleStatus,
  type MemberRow,
  type MemberTableRow,
  type PeriodFilter,
  type PeriodKey,
  useMemberTable,
} from "@/components/admin/member-ledger";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

function sortIcon(sorted: false | "asc" | "desc") {
  if (sorted === "asc") return <span aria-hidden="true">↑</span>;
  if (sorted === "desc") return <span aria-hidden="true">↓</span>;
  return <ArrowDownUp className="size-3.5 opacity-40" aria-hidden="true" />;
}

/**
 * Single source of truth for status colour. The table badge and the filter that
 * selects that status read from the same entry, so the two can never drift.
 * `chip` tints the pill/trigger, `dot` colours the leading marker.
 */
type Tone = { chip: string; dot: string };

const NEUTRAL_TONE: Tone = {
  chip: "border-slate-200 bg-white text-slate-700",
  dot: "bg-slate-300",
};

const FINANCIAL_TONES: Record<FinancialStatus, Tone> = {
  paid: { chip: "border-emerald-200 bg-emerald-50 text-emerald-700", dot: "bg-emerald-500" },
  overdue: { chip: "border-red-200 bg-red-50 text-red-700", dot: "bg-red-500" },
  under_review: { chip: "border-amber-200 bg-amber-50 text-amber-800", dot: "bg-amber-500" },
  awaiting_payment: {
    chip: "border-orange-200 bg-orange-50 text-orange-800",
    dot: "bg-orange-500",
  },
  scheduled: { chip: "border-blue-200 bg-blue-50 text-blue-700", dot: "bg-blue-500" },
  no_obligation: { chip: "border-slate-200 bg-slate-50 text-slate-600", dot: "bg-slate-400" },
};

/** `not_paid` groups several statuses, so it gets its own neutral-but-marked tone. */
const NOT_PAID_TONE: Tone = {
  chip: "border-slate-300 bg-slate-100 text-slate-700",
  dot: "bg-slate-500",
};

const LIFECYCLE_TONES: Record<LifecycleStatus, Tone> = {
  active: { chip: "border-emerald-200 bg-emerald-50 text-emerald-700", dot: "bg-emerald-500" },
  applicant: { chip: "border-violet-200 bg-violet-50 text-violet-700", dot: "bg-violet-500" },
  draft: {
    chip: "border-dashed border-slate-300 bg-slate-50 text-slate-500",
    dot: "bg-slate-400",
  },
};

/** The plan is not a status, so it stays quiet -- annual is the only tinted one. */
const PLAN_TONES: Record<"annual" | "monthly", Tone> = {
  annual: { chip: "border-indigo-200 bg-indigo-50 text-indigo-700", dot: "bg-indigo-500" },
  monthly: { chip: "border-slate-200 bg-slate-50 text-slate-600", dot: "bg-slate-400" },
};

function financialTone(status: FinancialFilter): Tone {
  if (status === "all") return NEUTRAL_TONE;
  if (status === "not_paid") return NOT_PAID_TONE;
  return FINANCIAL_TONES[status];
}

function lifecycleTone(status: LifecycleFilter): Tone {
  return status === "all" ? NEUTRAL_TONE : LIFECYCLE_TONES[status];
}

type BillingWorkspaceLedgerProps = {
  data: MemberRow[];
  periodOptions: ReadonlyArray<{ key: PeriodKey; label: string }>;
};

export default function BillingWorkspaceLedger({
  data,
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
    initialPeriodKey: "all",
    periodOptions,
  });
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
      const tone = lifecycleTone(row.lifecycle);

      return (
        <StatusChip tone={tone}>
          <ChipDot tone={tone} />
          {lifecycleLabels[row.lifecycle]}
        </StatusChip>
      );
    }

    if (columnId === "financialStatus") {
      const tone = financialTone(period.status);

      return (
        <StatusChip tone={tone}>
          <ChipDot tone={tone} />
          {financialLabels[period.status]}
        </StatusChip>
      );
    }

    if (columnId === "plan") {
      return row.plan ? (
        <StatusChip tone={PLAN_TONES[row.plan === "annual" ? "annual" : "monthly"]}>
          {row.plan === "annual" ? t("plans.annual") : t("plans.monthly")}
        </StatusChip>
      ) : (
        <span className="text-slate-300" aria-hidden="true">
          —
        </span>
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

    return <span>{String(row[columnId as keyof MemberTableRow] ?? "—")}</span>;
  };

  return (
    <section
      aria-labelledby="billing-ledger-title"
      className="flex min-h-0 flex-1 flex-col overflow-hidden"
    >
      <div className="shrink-0 border-b border-slate-200/80 pb-5 pt-0">
        <h1 id="billing-ledger-title" className="text-xl font-semibold tracking-tight text-slate-950">
          {t("ledger.title")}
        </h1>

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
            onChange={(value) => model.setPeriodKey(value as PeriodFilter)}
            options={[
              { value: "all", label: t("ledger.period.all") },
              ...model.periodOptions.map((option) => ({
                value: option.key,
                label: option.label,
              })),
            ]}
            icon={<CalendarDays className="size-3.5" aria-hidden="true" />}
          />
          <FilterSelect
            ariaLabel={t("ledger.lifecycleLabel")}
            value={model.filters.lifecycle}
            onChange={(value) => model.setLifecycleFilter(value as LifecycleFilter)}
            options={[
              { value: "all", label: t("ledger.lifecycle.all") },
              {
                value: "active",
                label: t("ledger.lifecycle.activePlural"),
                tone: LIFECYCLE_TONES.active,
              },
              {
                value: "applicant",
                label: t("ledger.lifecycle.applicants"),
                tone: LIFECYCLE_TONES.applicant,
              },
              {
                value: "draft",
                label: t("ledger.lifecycle.drafts"),
                tone: LIFECYCLE_TONES.draft,
              },
            ]}
            icon={<Users className="size-3.5" aria-hidden="true" />}
          />
          <FilterSelect
            ariaLabel={t("ledger.financialLabel")}
            value={model.filters.financial}
            onChange={(value) => model.setFinancialFilter(value as FinancialFilter)}
            options={[
              { value: "all", label: t("ledger.financial.all") },
              {
                value: "not_paid",
                label: t("ledger.financial.notPaid"),
                tone: NOT_PAID_TONE,
              },
              {
                value: "overdue",
                label: t("ledger.financial.overdue"),
                tone: FINANCIAL_TONES.overdue,
              },
              {
                value: "under_review",
                label: t("ledger.financial.underReview"),
                tone: FINANCIAL_TONES.under_review,
              },
              {
                value: "awaiting_payment",
                label: t("ledger.financial.awaitingPayment"),
                tone: FINANCIAL_TONES.awaiting_payment,
              },
              {
                value: "scheduled",
                label: t("ledger.financial.scheduled"),
                tone: FINANCIAL_TONES.scheduled,
              },
              {
                value: "paid",
                label: t("ledger.financial.paid"),
                tone: FINANCIAL_TONES.paid,
              },
              {
                value: "no_obligation",
                label: t("ledger.financial.noObligation"),
                tone: FINANCIAL_TONES.no_obligation,
              },
            ]}
            icon={<SlidersHorizontal className="size-3.5" aria-hidden="true" />}
          />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        <table className="min-w-[1050px] w-full border-collapse text-left text-sm">
          <caption className="sr-only">{t("ledger.tableLabel")}</caption>
          <thead className="text-xs uppercase tracking-[0.08em] text-slate-500">
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
              </tr>
            ))}
          </thead>
          <tbody className="divide-y divide-slate-100">
            {model.table.getRowModel().rows.length > 0 ? (
              model.table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  // The row is the only way in now that the action column is
                  // gone, so it has to be reachable and operable by keyboard,
                  // not just clickable.
                  tabIndex={0}
                  aria-label={t("ledger.reviewPerson", {
                    name: row.original.name || t("common.unnamedMember"),
                  })}
                  className="cursor-pointer transition-colors hover:bg-white/60 focus-visible:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                  onClick={() => model.setSelectedRowId(row.id)}
                  onKeyDown={(event) => {
                    if (event.key !== "Enter" && event.key !== " ") return;
                    event.preventDefault();
                    model.setSelectedRowId(row.id);
                  }}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="whitespace-nowrap px-5 py-4 align-middle md:px-6">
                      {renderCell(row.original, cell.column.id)}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={6} className="px-6 py-16 text-center">
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

      <div className="flex shrink-0 flex-col gap-3 border-t border-slate-200/80 py-4 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between">
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

/**
 * The ledger's pill. Tone supplies the colour; the dot is passed as a child so a
 * chip that carries no status (the plan) simply omits it.
 */
function StatusChip({ children, tone }: { children: ReactNode; tone: Tone }) {
  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1",
        "text-xs font-medium leading-none shadow-[0_1px_1.5px_rgba(15,23,42,0.04)]",
        tone.chip,
      )}
    >
      {children}
    </span>
  );
}

function ChipDot({ tone }: { tone: Tone }) {
  return (
    <span
      className={cn("size-1.5 shrink-0 rounded-full", tone.dot)}
      aria-hidden="true"
    />
  );
}

type FilterOption = { value: string; label: string; tone?: Tone };

/**
 * Filter control for the ledger table.
 *
 * When an option carries a `tone`, the trigger adopts that tone once selected —
 * so a filter narrowed to "Overdue" reads as the same red pill the column shows,
 * and an idle filter stays neutral. That makes an active filter legible at a
 * glance without a separate "filters applied" indicator.
 *
 * Radix (rather than a native `<select>`) because `<option>` cannot be styled
 * cross-browser, and the dots in the list are what teach the colour mapping.
 */
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
  options: FilterOption[];
  value: string;
}) {
  const selected = options.find((option) => option.value === value);
  const tone = selected?.tone ?? NEUTRAL_TONE;
  const isToned = Boolean(selected?.tone) && tone !== NEUTRAL_TONE;

  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger
        aria-label={ariaLabel}
        className={cn(
          "h-10 w-full rounded-xl border px-3 text-sm font-medium shadow-none",
          "touch-manipulation transition-colors",
          // The base trigger sets [&>span]:line-clamp-1, whose display:-webkit-box
          // outranks the wrapper's own `flex` and stacks the icon above the label.
          // (line-clamp-none is NOT the fix -- it emits display:block.) The
          // :first-child variant raises specificity enough to restore the row.
          "[&>span:first-child]:flex",
          "focus:ring-0 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
          "data-[state=open]:ring-2 data-[state=open]:ring-ring",
          tone.chip
        )}
      >
        <span className="flex min-w-0 items-center gap-2">
          {isToned ? (
            <span
              className={cn("inline-block size-1.5 shrink-0 rounded-full", tone.dot)}
              aria-hidden="true"
            />
          ) : (
            icon ?? null
          )}
          {/*
            Rendered directly rather than via <SelectValue />, which mirrors the
            selected item's children and would repeat the dot on the trigger.
          */}
          <span className="truncate">{selected?.label}</span>
        </span>
      </SelectTrigger>
      <SelectContent className="rounded-xl border-slate-200 p-1.5">
        {options.map((option) => (
          <SelectItem
            key={option.value}
            value={option.value}
            className="cursor-pointer rounded-lg py-2 pl-2.5 pr-8 text-sm text-slate-700 focus:bg-slate-100 focus:text-slate-900"
          >
            <span className="flex items-center gap-2.5">
              {option.tone ? (
                <span
                  className={cn(
                    "inline-block size-1.5 shrink-0 rounded-full",
                    option.tone.dot
                  )}
                  aria-hidden="true"
                />
              ) : null}
              {option.label}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
