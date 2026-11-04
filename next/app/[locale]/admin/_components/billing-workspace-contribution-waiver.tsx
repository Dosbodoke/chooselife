"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, HandCoins, Loader2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useId, useState } from "react";

import { formatCurrency, formatDate, formatMonth } from "@/components/admin/member-ledger";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  type ContributionWaiverFailure,
  type ContributionWaiverResult,
  normalizeWaiverReason,
  selectedCharges,
  sumCharges,
  type WaivableCharge,
  WAIVER_MAX_SELECTION,
  WAIVER_REASON_MAX_LENGTH,
  waiverFailure,
} from "@/lib/contribution-waiver";
import { supabaseBrowser } from "@/utils/supabase/client";

const supabase = supabaseBrowser();

type RpcError = { code?: string; hint?: string | null; message?: string };

type Step = "closed" | "select" | "review";

type Waived = { count: number; amount: number; currency: string };

/**
 * Each step replaces the button that opened it, so focus would fall back to the
 * page. Landing it on the step itself keeps keyboard and screen reader users in
 * place without picking a control for them.
 */
const focusOnMount = (node: HTMLElement | null) => {
  node?.focus();
};

/** What still stops the admin from reviewing, or null when nothing does. */
function missingInput(selection: WaivableCharge[], reason: string | null) {
  if (selection.length === 0) return "selectionRequired";
  if (reason === null) return "reasonRequired";
  return null;
}

/**
 * Forgives some overdue months of one person. Not a payment: the months become
 * void, nothing is marked paid, and the history keeps them with the reason.
 *
 * Choosing and confirming are two steps inside the drawer, never a dialog over
 * it. What the admin typed and ticked survives every refusal; only a success
 * clears it. The database re-checks everything -- admin, person, each month --
 * and either waives the whole selection or none of it.
 *
 * Keyed by member in the drawer, so moving to another person starts clean.
 */
export default function BillingWorkspaceContributionWaiver({
  charges,
  memberId,
  memberLabel,
  organizationId,
}: {
  charges: WaivableCharge[];
  memberId: string;
  memberLabel: string;
  organizationId: string | null;
}) {
  const t = useTranslations("admin.waiver");
  const locale = useLocale();
  const displayLocale = locale.toLowerCase().startsWith("pt") ? "pt-BR" : "en-US";
  const queryClient = useQueryClient();
  const [step, setStep] = useState<Step>("closed");
  const [selectedIds, setSelectedIds] = useState<ReadonlySet<string>>(new Set());
  const [reason, setReason] = useState("");
  const [waived, setWaived] = useState<Waived | null>(null);

  // Read against the latest charges, so a month paid or claimed since it was
  // ticked quietly leaves the selection instead of failing the whole batch.
  const selection = selectedCharges(charges, selectedIds);
  const currency = selection[0]?.currency ?? charges[0]?.currency ?? "BRL";
  const normalizedReason = normalizeWaiverReason(reason);

  const refresh = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ["billing-workspace", organizationId] }),
      queryClient.invalidateQueries({
        queryKey: ["association-member-detail", organizationId, memberId],
      }),
      queryClient.invalidateQueries({
        queryKey: ["membership-payment-reminder", organizationId, memberId],
      }),
    ]);

  const waiveMutation = useMutation<ContributionWaiverResult[], RpcError>({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("waive_recurring_contributions", {
        p_organization_id: organizationId!,
        p_user_id: memberId,
        p_obligation_ids: selection.map((charge) => charge.obligationId),
        p_reason: normalizedReason ?? "",
      });
      if (error) throw error;
      if (!data?.length) throw { code: "unknown" } satisfies RpcError;
      return data;
    },
    onSuccess: (rows) => {
      setWaived({
        count: rows.length,
        amount: rows.reduce((sum, row) => sum + row.amount, 0),
        currency: rows[0]?.currency ?? currency,
      });
      setStep("closed");
      setSelectedIds(new Set());
      setReason("");
      void refresh();
    },
    onError: () => {
      // A refusal means the screen was stale; a lost response may hide a
      // commit. Either way the truth is on the server, so fetch it.
      void refresh();
    },
  });

  // Nothing left to forgive and nothing just forgiven: no section at all.
  if (charges.length === 0 && !waived && !waiveMutation.isError) return null;

  const missing = missingInput(selection, normalizedReason);
  // With nothing left to forgive, only the outcome of the last attempt shows.
  const activeStep = charges.length > 0 ? step : null;

  const cancel = () => {
    setStep("closed");
    setSelectedIds(new Set());
    setReason("");
    waiveMutation.reset();
  };

  const goTo = (next: Step) => {
    waiveMutation.reset();
    setStep(next);
  };

  return (
    <section className="rounded-2xl border border-border bg-muted/40 p-4">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <HandCoins className="size-4 text-muted-foreground" aria-hidden="true" />
        {t("title")}
      </h3>

      {charges.length > 0 ? (
        <p className="mt-1 text-sm text-muted-foreground">
          {t("intro", { count: charges.length })}
        </p>
      ) : null}

      {waived ? <WaiverDoneNotice waived={waived} displayLocale={displayLocale} /> : null}

      {waiveMutation.isError ? <WaiverFailureAlert error={waiveMutation.error} /> : null}

      {activeStep === "closed" ? (
        <Button
          type="button"
          variant="outline"
          className="mt-3 rounded-lg"
          onClick={() => {
            setWaived(null);
            setStep("select");
          }}
        >
          <HandCoins className="mr-2 size-4" aria-hidden="true" />
          {t("start")}
        </Button>
      ) : null}

      {activeStep === "select" ? (
        <WaiverSelectStep
          charges={charges}
          displayLocale={displayLocale}
          missing={missing === null ? null : t(missing)}
          reason={reason}
          selection={selection}
          onCancel={cancel}
          onReasonChange={setReason}
          onReview={() => goTo("review")}
          onSelectionChange={setSelectedIds}
        />
      ) : null}

      {activeStep === "review" ? (
        <WaiverReviewStep
          currency={currency}
          displayLocale={displayLocale}
          memberLabel={memberLabel}
          pending={waiveMutation.isPending}
          reason={normalizedReason}
          selection={selection}
          canConfirm={missing === null}
          onBack={() => goTo("select")}
          onConfirm={() => waiveMutation.mutate()}
        />
      ) : null}
    </section>
  );
}

function WaiverDoneNotice({
  displayLocale,
  waived,
}: {
  displayLocale: string;
  waived: Waived;
}) {
  const t = useTranslations("admin.waiver");

  return (
    <div
      role="status"
      className="mt-3 flex gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-3 text-sm text-emerald-900 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200"
    >
      <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <span>
        {t("done", {
          count: waived.count,
          total: formatCurrency(waived.amount, waived.currency, displayLocale),
        })}
      </span>
    </div>
  );
}

function WaiverFailureAlert({ error }: { error: RpcError }) {
  const t = useTranslations("admin.waiver");
  const failureCopy: Record<ContributionWaiverFailure, string> = {
    invalid_selection: t("errors.invalidSelection"),
    not_waivable: t("errors.notWaivable"),
    reason_required: t("errors.reasonRequired"),
    reason_too_long: t("errors.reasonTooLong"),
    unauthorized: t("errors.unauthorized"),
    under_review: t("errors.underReview"),
    unknown: t("errors.unknown"),
  };

  return (
    <p
      role="alert"
      className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300"
    >
      {failureCopy[waiverFailure(error)]}
    </p>
  );
}

/** Ticks the months and takes the reason. Nothing is sent from here. */
function WaiverSelectStep({
  charges,
  displayLocale,
  missing,
  reason,
  selection,
  onCancel,
  onReasonChange,
  onReview,
  onSelectionChange,
}: {
  charges: WaivableCharge[];
  displayLocale: string;
  missing: string | null;
  reason: string;
  selection: WaivableCharge[];
  onCancel: () => void;
  onReasonChange: (reason: string) => void;
  onReview: () => void;
  onSelectionChange: (ids: ReadonlySet<string>) => void;
}) {
  const t = useTranslations("admin.waiver");
  const reasonId = useId();
  const reasonHintId = useId();
  const selectedIds = new Set(selection.map((charge) => charge.obligationId));
  const selectable = Math.min(charges.length, WAIVER_MAX_SELECTION);
  const allSelected = charges.length > 0 && selection.length === selectable;

  const toggle = (obligationId: string) => {
    const next = new Set(selectedIds);
    if (next.has(obligationId)) next.delete(obligationId);
    else if (next.size < WAIVER_MAX_SELECTION) next.add(obligationId);
    onSelectionChange(next);
  };

  const toggleAll = () => {
    onSelectionChange(
      allSelected
        ? new Set()
        : new Set(
            charges
              .slice(0, WAIVER_MAX_SELECTION)
              .map((charge) => charge.obligationId),
          ),
    );
  };

  return (
    <div
      tabIndex={-1}
      ref={focusOnMount}
      aria-label={t("start")}
      className="mt-3 rounded-xl border border-border bg-card p-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <fieldset>
        <legend className="sr-only">{t("periods")}</legend>
        <label className="flex cursor-pointer items-center gap-3 border-b border-border/60 pb-3 text-sm font-medium text-foreground">
          <input
            type="checkbox"
            className="size-4 rounded border-input accent-foreground"
            checked={allSelected}
            onChange={toggleAll}
          />
          {t("selectAll", { count: selectable })}
        </label>
        <ul className="mt-1 divide-y divide-border/60">
          {charges.map((charge) => (
            <li key={charge.obligationId}>
              <label className="flex cursor-pointer items-center justify-between gap-3 py-2.5 text-sm">
                <span className="flex min-w-0 items-center gap-3">
                  <input
                    type="checkbox"
                    className="size-4 shrink-0 rounded border-input accent-foreground"
                    checked={selectedIds.has(charge.obligationId)}
                    onChange={() => toggle(charge.obligationId)}
                  />
                  <span className="min-w-0">
                    <span className="block text-foreground/80">
                      {formatMonth(charge.dueOn, displayLocale)}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {t("dueOn", { date: formatDate(charge.dueOn, displayLocale) })}
                    </span>
                  </span>
                </span>
                <span className="shrink-0 font-semibold tabular-nums text-foreground">
                  {formatCurrency(charge.amount, charge.currency, displayLocale)}
                </span>
              </label>
            </li>
          ))}
        </ul>
      </fieldset>

      <div className="mt-4">
        <label htmlFor={reasonId} className="text-sm font-medium text-foreground">
          {t("reasonLabel")}
        </label>
        <Textarea
          id={reasonId}
          aria-describedby={reasonHintId}
          className="mt-1.5 min-h-20 rounded-lg bg-card"
          maxLength={WAIVER_REASON_MAX_LENGTH}
          value={reason}
          onChange={(event) => onReasonChange(event.target.value)}
        />
        <p
          id={reasonHintId}
          className="mt-1 flex justify-between gap-3 text-xs text-muted-foreground"
        >
          <span>{t("reasonHint")}</span>
          <span className="tabular-nums">
            {t("reasonCount", {
              count: reason.length,
              max: WAIVER_REASON_MAX_LENGTH,
            })}
          </span>
        </p>
      </div>

      {missing ? <p className="mt-3 text-xs text-muted-foreground">{missing}</p> : null}

      <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" className="rounded-lg" onClick={onCancel}>
          {t("cancel")}
        </Button>
        <Button
          type="button"
          className="rounded-lg"
          disabled={missing !== null}
          onClick={onReview}
        >
          {t("review")}
        </Button>
      </div>
    </div>
  );
}

/** Shows exactly what will be waived, and is the only place that sends it. */
function WaiverReviewStep({
  canConfirm,
  currency,
  displayLocale,
  memberLabel,
  pending,
  reason,
  selection,
  onBack,
  onConfirm,
}: {
  canConfirm: boolean;
  currency: string;
  displayLocale: string;
  memberLabel: string;
  pending: boolean;
  reason: string | null;
  selection: WaivableCharge[];
  onBack: () => void;
  onConfirm: () => void;
}) {
  const t = useTranslations("admin.waiver");

  return (
    <div
      tabIndex={-1}
      ref={focusOnMount}
      aria-label={t("review")}
      className="mt-3 rounded-xl border border-border bg-card p-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <dl className="grid gap-3 text-sm sm:grid-cols-[auto_1fr] sm:gap-x-4">
        <dt className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">
          {t("recipient")}
        </dt>
        <dd className="min-w-0 font-medium text-foreground">{memberLabel}</dd>
        <dt className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">
          {t("periods")}
        </dt>
        <dd className="min-w-0">
          <ul className="space-y-1">
            {selection.map((charge) => (
              <li
                key={charge.obligationId}
                className="flex justify-between gap-3 text-foreground/80"
              >
                <span>{formatMonth(charge.dueOn, displayLocale)}</span>
                <span className="tabular-nums">
                  {formatCurrency(charge.amount, charge.currency, displayLocale)}
                </span>
              </li>
            ))}
          </ul>
        </dd>
        <dt className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">
          {t("total")}
        </dt>
        <dd className="font-semibold tabular-nums text-foreground">
          {formatCurrency(sumCharges(selection), currency, displayLocale)}
        </dd>
        <dt className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">
          {t("reasonLabel")}
        </dt>
        <dd className="min-w-0 whitespace-pre-wrap break-words text-foreground/80">
          {reason}
        </dd>
      </dl>

      <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
        {t("consequence")}
      </p>

      <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button
          type="button"
          variant="outline"
          className="rounded-lg"
          disabled={pending}
          onClick={onBack}
        >
          {t("back")}
        </Button>
        <Button
          type="button"
          variant="destructive"
          className="rounded-lg"
          disabled={pending || !canConfirm}
          aria-busy={pending}
          onClick={onConfirm}
        >
          {pending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
          {pending ? t("confirming") : t("confirm", { count: selection.length })}
        </Button>
      </div>
    </div>
  );
}
