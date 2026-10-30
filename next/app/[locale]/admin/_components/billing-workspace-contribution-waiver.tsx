"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, HandCoins, Loader2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useId, useState } from "react";

import { formatCurrency, formatDate } from "@/components/admin/member-ledger";
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

/** Same "September 2026" shape the ledger's period rows use. */
function monthLabel(dueOn: string, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    month: "long",
    year: "numeric",
  }).format(new Date(`${dueOn.slice(0, 7)}-01T00:00:00`));
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
  const reasonId = useId();
  const reasonHintId = useId();
  const [step, setStep] = useState<Step>("closed");
  const [selectedIds, setSelectedIds] = useState<ReadonlySet<string>>(new Set());
  const [reason, setReason] = useState("");
  const [waived, setWaived] = useState<Waived | null>(null);
  const focusReview = useCallback((node: HTMLDivElement | null) => {
    node?.focus();
  }, []);

  // Read against the latest charges, so a month paid or claimed since it was
  // ticked quietly leaves the selection instead of failing the whole batch.
  const selection = selectedCharges(charges, selectedIds);
  const total = sumCharges(selection);
  const currency = selection[0]?.currency ?? charges[0]?.currency ?? "BRL";
  const normalizedReason = normalizeWaiverReason(reason);
  const allSelected =
    charges.length > 0 && selection.length === Math.min(charges.length, WAIVER_MAX_SELECTION);

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

  const failureCopy: Record<ContributionWaiverFailure, string> = {
    invalid_selection: t("errors.invalidSelection"),
    not_waivable: t("errors.notWaivable"),
    reason_required: t("errors.reasonRequired"),
    reason_too_long: t("errors.reasonTooLong"),
    unauthorized: t("errors.unauthorized"),
    under_review: t("errors.underReview"),
    unknown: t("errors.unknown"),
  };

  // Nothing left to forgive and nothing just forgiven: no section at all.
  if (charges.length === 0 && !waived && !waiveMutation.isError) return null;

  const pending = waiveMutation.isPending;

  const toggle = (obligationId: string) => {
    const next = new Set(selection.map((charge) => charge.obligationId));
    if (next.has(obligationId)) next.delete(obligationId);
    else if (next.size < WAIVER_MAX_SELECTION) next.add(obligationId);
    setSelectedIds(next);
  };

  const toggleAll = () => {
    setSelectedIds(
      allSelected
        ? new Set()
        : new Set(
            charges
              .slice(0, WAIVER_MAX_SELECTION)
              .map((charge) => charge.obligationId),
          ),
    );
  };

  const cancel = () => {
    setStep("closed");
    setSelectedIds(new Set());
    setReason("");
    waiveMutation.reset();
  };

  const missing =
    selection.length === 0
      ? t("selectionRequired")
      : normalizedReason === null
        ? t("reasonRequired")
        : null;

  return (
    <section className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
        <HandCoins className="size-4 text-slate-500" aria-hidden="true" />
        {t("title")}
      </h3>

      {charges.length > 0 ? (
        <p className="mt-1 text-sm text-slate-600">
          {t("intro", { count: charges.length })}
        </p>
      ) : null}

      {waived ? (
        <div
          role="status"
          className="mt-3 flex gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-3 text-sm text-emerald-900"
        >
          <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>
            {t("done", {
              count: waived.count,
              total: formatCurrency(waived.amount, waived.currency, displayLocale),
            })}
          </span>
        </div>
      ) : null}

      {waiveMutation.isError ? (
        <p
          role="alert"
          className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
        >
          {failureCopy[waiverFailure(waiveMutation.error)]}
        </p>
      ) : null}

      {charges.length === 0 ? null : step === "closed" ? (
        <Button
          type="button"
          variant="outline"
          className="mt-3 rounded-lg"
          onClick={() => {
            setWaived(null);
            setStep("select");
          }}
        >
          <HandCoins className="size-4" aria-hidden="true" />
          {t("start")}
        </Button>
      ) : step === "select" ? (
        <div className="mt-3 rounded-xl border border-slate-200 bg-white p-4">
          <fieldset>
            <legend className="sr-only">{t("periods")}</legend>
            <label className="flex cursor-pointer items-center gap-3 border-b border-slate-100 pb-3 text-sm font-medium text-slate-900">
              {/* Lands keyboard focus inside the step that just opened. */}
              <input
                type="checkbox"
                autoFocus
                className="size-4 rounded border-slate-300 accent-slate-900"
                checked={allSelected}
                onChange={toggleAll}
              />
              {t("selectAll", { count: Math.min(charges.length, WAIVER_MAX_SELECTION) })}
            </label>
            <ul className="mt-1 divide-y divide-slate-100">
              {charges.map((charge) => (
                <li key={charge.obligationId}>
                  <label className="flex cursor-pointer items-center justify-between gap-3 py-2.5 text-sm">
                    <span className="flex min-w-0 items-center gap-3">
                      <input
                        type="checkbox"
                        className="size-4 shrink-0 rounded border-slate-300 accent-slate-900"
                        checked={selectedIds.has(charge.obligationId)}
                        onChange={() => toggle(charge.obligationId)}
                      />
                      <span className="min-w-0">
                        <span className="block text-slate-700">
                          {monthLabel(charge.dueOn, displayLocale)}
                        </span>
                        <span className="block text-xs text-slate-500">
                          {t("dueOn", { date: formatDate(charge.dueOn, displayLocale) })}
                        </span>
                      </span>
                    </span>
                    <span className="shrink-0 font-semibold tabular-nums text-slate-900">
                      {formatCurrency(charge.amount, charge.currency, displayLocale)}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          </fieldset>

          <div className="mt-4">
            <label htmlFor={reasonId} className="text-sm font-medium text-slate-900">
              {t("reasonLabel")}
            </label>
            <Textarea
              id={reasonId}
              aria-describedby={reasonHintId}
              className="mt-1.5 min-h-20 rounded-lg bg-white"
              maxLength={WAIVER_REASON_MAX_LENGTH}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
            <p
              id={reasonHintId}
              className="mt-1 flex justify-between gap-3 text-xs text-slate-500"
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

          {missing ? <p className="mt-3 text-xs text-slate-500">{missing}</p> : null}

          <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" className="rounded-lg" onClick={cancel}>
              {t("cancel")}
            </Button>
            <Button
              type="button"
              className="rounded-lg"
              disabled={missing !== null}
              onClick={() => {
                waiveMutation.reset();
                setStep("review");
              }}
            >
              {t("review")}
            </Button>
          </div>
        </div>
      ) : (
        <div
          tabIndex={-1}
          ref={focusReview}
          aria-label={t("review")}
          className="mt-3 rounded-xl border border-slate-200 bg-white p-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <dl className="grid gap-3 text-sm sm:grid-cols-[auto_1fr] sm:gap-x-4">
            <dt className="text-xs font-medium uppercase tracking-[0.08em] text-slate-500">
              {t("recipient")}
            </dt>
            <dd className="min-w-0 font-medium text-slate-900">{memberLabel}</dd>
            <dt className="text-xs font-medium uppercase tracking-[0.08em] text-slate-500">
              {t("periods")}
            </dt>
            <dd className="min-w-0">
              <ul className="space-y-1">
                {selection.map((charge) => (
                  <li
                    key={charge.obligationId}
                    className="flex justify-between gap-3 text-slate-700"
                  >
                    <span>{monthLabel(charge.dueOn, displayLocale)}</span>
                    <span className="tabular-nums">
                      {formatCurrency(charge.amount, charge.currency, displayLocale)}
                    </span>
                  </li>
                ))}
              </ul>
            </dd>
            <dt className="text-xs font-medium uppercase tracking-[0.08em] text-slate-500">
              {t("total")}
            </dt>
            <dd className="font-semibold tabular-nums text-slate-900">
              {formatCurrency(total, currency, displayLocale)}
            </dd>
            <dt className="text-xs font-medium uppercase tracking-[0.08em] text-slate-500">
              {t("reasonLabel")}
            </dt>
            <dd className="min-w-0 whitespace-pre-wrap break-words text-slate-700">
              {normalizedReason}
            </dd>
          </dl>

          <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-900">
            {t("consequence")}
          </p>

          <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              className="rounded-lg"
              disabled={pending}
              onClick={() => {
                waiveMutation.reset();
                setStep("select");
              }}
            >
              {t("back")}
            </Button>
            <Button
              type="button"
              variant="destructive"
              className="rounded-lg"
              disabled={pending || missing !== null}
              aria-busy={pending}
              onClick={() => waiveMutation.mutate()}
            >
              {pending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
              {pending ? t("confirming") : t("confirm", { count: selection.length })}
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}
