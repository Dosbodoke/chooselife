"use client";

import { flexRender } from "@tanstack/react-table";
import {
  ArrowDown,
  ArrowDownUp,
  ArrowUp,
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

import { ApplicantAvatar } from "./initial-payment-claim-review";

function sortIcon(sorted: false | "asc" | "desc") {
  if (sorted === "asc") return <ArrowUp className="size-3.5" aria-hidden="true" />;
  if (sorted === "desc") return <ArrowDown className="size-3.5" aria-hidden="true" />;
  // Six idle arrows in a row are noise; the hint only shows where the pointer is.
  return (
    <ArrowDownUp
      className="size-3.5 opacity-0 transition-opacity duration-150 group-hover/sort:opacity-50 group-focus-visible/sort:opacity-50"
      aria-hidden="true"
    />
  );
}

function ariaSort(sorted: false | "asc" | "desc") {
  if (sorted === "asc") return "ascending";
  if (sorted === "desc") return "descending";
  return undefined;
}

/**
 * Single source of truth for status colour. The table badge and the filter that
 * selects that status read from the same entry, so the two can never drift.
 * `chip` tints the pill/trigger, `dot` colours the leading marker.
 */
type Tone = { chip: string; dot: string };

// Spelled out in full so Tailwind can see every class at build time.
const TINTS = {
  emerald:
    "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300",
  red: "border-red-200 bg-red-50 text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300",
  rose: "border-rose-300 bg-rose-100 text-rose-900 dark:border-rose-500/40 dark:bg-rose-500/15 dark:text-rose-200",
  amber:
    "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300",
  orange:
    "border-orange-200 bg-orange-50 text-orange-800 dark:border-orange-500/30 dark:bg-orange-500/10 dark:text-orange-300",
  blue: "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-300",
  violet:
    "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-500/30 dark:bg-violet-500/10 dark:text-violet-300",
  indigo:
    "border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-500/30 dark:bg-indigo-500/10 dark:text-indigo-300",
} satisfies Record<string, string>;

/**
 * A tinted chip: pastel on light, a low-alpha wash of the same hue on dark, so
 * the colour still reads as that status against a near-black background.
 */
function tinted(hue: keyof typeof TINTS, dot: string): Tone {
  return { chip: TINTS[hue], dot };
}

const NEUTRAL_TONE: Tone = {
  chip: "border-border bg-card text-foreground",
  dot: "bg-muted-foreground/40",
};

const QUIET_TONE: Tone = {
  chip: "border-border bg-muted/50 text-muted-foreground",
  dot: "bg-muted-foreground/60",
};

const FINANCIAL_TONES: Record<FinancialStatus, Tone> = {
  paid: tinted("emerald", "bg-emerald-500"),
  overdue: tinted("red", "bg-red-500"),
  // Deeper and more saturated than `overdue`, so a refusal is not mistaken for a
  // missed due date when the two sit in the same column.
  rejected: tinted("rose", "bg-rose-700 dark:bg-rose-400"),
  under_review: tinted("amber", "bg-amber-500"),
  awaiting_payment: tinted("orange", "bg-orange-500"),
  scheduled: tinted("blue", "bg-blue-500"),
  // Forgiven without money changing hands: neither the green of paid nor the
  // grey of a month that never had a charge.
  waived: tinted("violet", "bg-violet-500"),
  no_obligation: QUIET_TONE,
};

/** `not_paid` groups several statuses, so it gets its own neutral-but-marked tone. */
const NOT_PAID_TONE: Tone = {
  chip: "border-input bg-muted text-foreground",
  dot: "bg-muted-foreground",
};

const LIFECYCLE_TONES: Record<LifecycleStatus, Tone> = {
  active: tinted("emerald", "bg-emerald-500"),
  pending: tinted("violet", "bg-violet-500"),
  inactive: tinted("red", "bg-red-500"),
};

/** The plan is not a status, so it stays quiet -- annual is the only tinted one. */
const PLAN_TONES: Record<"annual" | "monthly", Tone> = {
  annual: tinted("indigo", "bg-indigo-500"),
  monthly: QUIET_TONE,
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
    pending: t("ledger.lifecycle.pending"),
    inactive: t("ledger.lifecycle.inactive"),
  };
  const financialLabels: Record<FinancialStatus, string> = {
    awaiting_payment: t("ledger.financial.awaitingPayment"),
    no_obligation: t("ledger.financial.noObligation"),
    overdue: t("ledger.financial.overdue"),
    paid: t("ledger.financial.paid"),
    rejected: t("ledger.financial.rejected"),
    scheduled: t("ledger.financial.scheduled"),
    under_review: t("ledger.financial.underReview"),
    waived: t("ledger.financial.waived"),
  };

  const renderCell = (row: MemberTableRow, columnId: string) => {
    const period = row.selectedPeriod;

    if (columnId === "name") {
      return (
        <div className="flex min-w-[220px] items-center gap-3">
          <ApplicantAvatar
            name={row.name}
            handle={row.handle}
            picture={row.profilePicture}
            size="sm"
          />
          <div className="min-w-0">
            <p className="truncate font-semibold text-foreground">
              {row.name || t("common.unnamedMember")}
            </p>
            <p className="truncate text-xs text-muted-foreground">
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
        <span className="text-muted-foreground/50" aria-hidden="true">
          —
        </span>
      );
    }

    if (columnId === "amount") {
      // A waived month shows what was billed, struck through: it is on record
      // but nobody owes it.
      return (
        <span
          className={cn(
            "font-medium tabular-nums",
            period.status === "waived" ? "text-muted-foreground/70 line-through" : "text-foreground",
          )}
        >
          {formatCurrency(period.amount, period.currency, displayLocale)}
        </span>
      );
    }

    if (columnId === "dueDate") {
      return (
        <span className="whitespace-nowrap text-muted-foreground">
          {formatDate(period.dueDate, displayLocale)}
        </span>
      );
    }

    return <span>{String(row[columnId as keyof MemberTableRow] ?? "—")}</span>;
  };

  const rows = model.table.getRowModel().rows;
  const emptyState = (
    <>
      <p className="font-semibold text-foreground">{t("ledger.emptyTitle")}</p>
      <p className="mt-1 text-pretty text-sm text-muted-foreground">
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
    </>
  );

  return (
    <section
      aria-labelledby="billing-ledger-title"
      className="flex min-h-0 flex-1 flex-col overflow-hidden"
    >
      <div className="shrink-0 pb-4 pt-1">
        <div className="flex items-baseline gap-2.5">
          <h1
            id="billing-ledger-title"
            className="text-balance text-2xl font-semibold tracking-tight text-foreground"
          >
            {t("ledger.title")}
          </h1>
          <span className="text-sm tabular-nums text-muted-foreground">
            {t("ledger.summary.people", { count: data.length })}
          </span>
        </div>

        {/* Two columns on a phone: four full-width rows of filters would push
            the members below the fold before anyone has typed anything. */}
        <div className="mt-4 grid grid-cols-2 gap-2.5 md:grid-cols-[minmax(220px,1.5fr)_repeat(3,minmax(150px,1fr))] md:gap-3">
          <label className="relative col-span-2 block md:col-span-1">
            <span className="sr-only">{t("ledger.searchLabel")}</span>
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/70"
              aria-hidden="true"
            />
            <Input
              value={model.filters.search}
              onChange={(event) => model.setSearch(event.target.value)}
              placeholder={t("ledger.searchPlaceholder")}
              className="h-10 rounded-xl border-border bg-card pl-9 shadow-none"
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
                value: "pending",
                label: t("ledger.lifecycle.pendingPlural"),
                tone: LIFECYCLE_TONES.pending,
              },
              {
                value: "inactive",
                label: t("ledger.lifecycle.inactivePlural"),
                tone: LIFECYCLE_TONES.inactive,
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
                value: "rejected",
                label: t("ledger.financial.rejected"),
                tone: FINANCIAL_TONES.rejected,
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
                value: "waived",
                label: t("ledger.financial.waived"),
                tone: FINANCIAL_TONES.waived,
              },
              {
                value: "no_obligation",
                label: t("ledger.financial.noObligation"),
                tone: FINANCIAL_TONES.no_obligation,
              },
            ]}
            icon={<SlidersHorizontal className="size-3.5" aria-hidden="true" />}
            className="col-span-2 md:col-span-1"
          />
        </div>

        {/* What needs chasing, at a glance. Each figure is also the shortcut to
            its filter, and pressing it again clears that filter. */}
        <div
          role="group"
          aria-label={t("ledger.summary.label")}
          className="mt-2.5 grid grid-cols-2 gap-2.5 md:mt-3 md:gap-3 lg:grid-cols-4"
        >
          {model.attentionSummary.map((entry) => {
            const active = model.filters.financial === entry.status;
            const tone = FINANCIAL_TONES[entry.status];
            // An empty bucket stays pressable but steps back, so the eye lands
            // on the buckets that actually have someone to chase.
            const empty = entry.people === 0 && !active;

            return (
              <button
                key={entry.status}
                type="button"
                aria-pressed={active}
                onClick={() =>
                  model.setFinancialFilter(active ? "all" : entry.status)
                }
                className={cn(
                  "flex min-w-0 touch-manipulation flex-col items-start rounded-xl border px-3.5 py-3 text-left",
                  "transition-[background-color,border-color,transform] duration-150 ease-out active:scale-[0.97] motion-reduce:active:scale-100",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  active ? tone.chip : "border-border bg-card hover:bg-muted/60",
                )}
              >
                <span
                  className={cn(
                    "flex min-w-0 items-center gap-1.5 text-xs font-medium",
                    !active && "text-muted-foreground",
                  )}
                >
                  <ChipDot tone={tone} />
                  <span className="truncate">{financialLabels[entry.status]}</span>
                </span>
                <span
                  className={cn(
                    "mt-1.5 text-lg font-semibold leading-tight tabular-nums",
                    empty ? "text-muted-foreground/70" : "text-foreground",
                  )}
                >
                  {t("ledger.summary.people", { count: entry.people })}
                </span>
                <span className="mt-0.5 text-xs tabular-nums text-muted-foreground">
                  {entry.amount > 0
                    ? formatCurrency(entry.amount, entry.currency, displayLocale)
                    : t("ledger.summary.nothingOpen")}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* A six-column table does not fit a phone, so below `md` the same page
          of rows is a list that leads with what an admin acts on: who, what
          state, how much. */}
      <ul
        aria-label={t("ledger.tableLabel")}
        className="min-h-0 flex-1 divide-y divide-border/60 overflow-auto rounded-2xl border border-border bg-card text-sm md:hidden"
      >
        {rows.length > 0 ? (
          rows.map((row) => {
            const period = row.original.selectedPeriod;

            return (
              <li key={row.id}>
                <button
                  type="button"
                  className="flex w-full touch-manipulation items-center gap-3 px-4 py-3 text-left transition-colors duration-150 active:bg-muted/60 focus-visible:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                  onClick={() => model.setSelectedRowId(row.id)}
                >
                  <ApplicantAvatar
                    name={row.original.name}
                    handle={row.original.handle}
                    picture={row.original.profilePicture}
                    size="sm"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium text-foreground">
                      {row.original.name || t("common.unnamedMember")}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {period.dueDate
                        ? formatDate(period.dueDate, displayLocale)
                        : row.original.handle || t("common.noHandle")}
                    </span>
                  </span>
                  <span className="flex shrink-0 flex-col items-end gap-1.5">
                    {renderCell(row.original, "financialStatus")}
                    {period.amount !== null
                      ? renderCell(row.original, "amount")
                      : null}
                  </span>
                </button>
              </li>
            );
          })
        ) : (
          <li className="px-6 py-14 text-center">{emptyState}</li>
        )}
      </ul>

      <div className="hidden min-h-0 flex-1 overflow-auto rounded-2xl border border-border bg-card shadow-[0_1px_2px_rgba(15,23,42,0.04)] md:block">
        <table className="w-full min-w-[960px] border-separate border-spacing-0 text-left text-sm">
          <caption className="sr-only">{t("ledger.tableLabel")}</caption>
          {/* Sticky so the column names stay put while a long ledger scrolls
              underneath. The rule is an inset shadow because a sticky cell's
              own border scrolls away with the body. */}
          <thead className="sticky top-0 z-10 text-xs text-muted-foreground">
            {model.table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    aria-sort={ariaSort(header.column.getIsSorted())}
                    className="bg-card px-4 py-2.5 font-medium shadow-[inset_0_-1px_0_var(--color-border)] first:pl-5"
                  >
                    {header.isPlaceholder ? null : (
                      <button
                        type="button"
                        className="group/sort -mx-1 inline-flex items-center gap-1.5 whitespace-nowrap rounded px-1 py-0.5 outline-none transition-colors duration-150 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
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
          <tbody>
            {rows.length > 0 ? (
              rows.map((row) => (
                <tr
                  key={row.id}
                  // The row is the only way in now that the action column is
                  // gone, so it has to be reachable and operable by keyboard,
                  // not just clickable.
                  tabIndex={0}
                  aria-label={t("ledger.reviewPerson", {
                    name: row.original.name || t("common.unnamedMember"),
                  })}
                  className="group/row cursor-pointer transition-colors duration-150 hover:bg-muted/50 focus-visible:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                  onClick={() => model.setSelectedRowId(row.id)}
                  onKeyDown={(event) => {
                    if (event.key !== "Enter" && event.key !== " ") return;
                    event.preventDefault();
                    model.setSelectedRowId(row.id);
                  }}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td
                      key={cell.id}
                      className="whitespace-nowrap border-b border-border/60 px-4 py-3 align-middle first:pl-5 group-last/row:border-b-0"
                    >
                      {renderCell(row.original, cell.column.id)}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={6} className="px-6 py-16 text-center">
                  {emptyState}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex shrink-0 items-center justify-between gap-3 py-3 text-sm text-muted-foreground">
        <span>
          {t("ledger.showing", {
            shown: rows.length,
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
          <span className="min-w-12 text-center text-xs font-medium tabular-nums text-muted-foreground">
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
  className,
  icon,
  onChange,
  options,
  value,
}: {
  ariaLabel: string;
  className?: string;
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
          tone.chip,
          className,
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
      {/* Grows out of the trigger it belongs to, not out of its own centre. */}
      <SelectContent className="origin-(--radix-select-content-transform-origin) rounded-xl border-border p-1.5">
        {options.map((option) => (
          <SelectItem
            key={option.value}
            value={option.value}
            className="cursor-pointer rounded-lg py-2 pl-2.5 pr-8 text-sm text-foreground/80 focus:bg-accent focus:text-accent-foreground"
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
