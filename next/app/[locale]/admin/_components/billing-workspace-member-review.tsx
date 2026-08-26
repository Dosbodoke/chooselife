"use client";

import { CalendarDays, Check, Clock3, Link2, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";

import {
  type FinancialStatus,
  formatCurrency,
  formatDate,
  formatDateTime,
  type MemberTableRow,
} from "@/components/admin/member-ledger";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

function statusTone(status: FinancialStatus) {
  if (status === "paid") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "overdue") return "border-red-200 bg-red-50 text-red-700";
  if (status === "under_review") return "border-amber-200 bg-amber-50 text-amber-800";
  if (status === "awaiting_payment") return "border-orange-200 bg-orange-50 text-orange-800";
  if (status === "scheduled") return "border-blue-200 bg-blue-50 text-blue-700";
  return "border-slate-200 bg-slate-50 text-slate-600";
}

/**
 * Copies the address bar as it stands, which the ledger keeps in sync with the
 * open filters and the focused member -- so what lands in the recipient's
 * browser is the screen the sender is looking at, not a bare /admin.
 */
function CopyViewLinkButton() {
  const t = useTranslations("admin");
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error("Error copying link to clipboard:", error);
    }
  };

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="shrink-0 rounded-lg"
        onClick={copy}
        aria-label={t("common.copyLink")}
      >
        {copied ? (
          <Check className="size-5 text-emerald-600" aria-hidden="true" />
        ) : (
          <Link2 className="size-5" aria-hidden="true" />
        )}
      </Button>
      {/* The icon swap is the sighted confirmation; this is its spoken twin. */}
      <span role="status" aria-live="polite" className="sr-only">
        {copied ? t("common.linkCopied") : ""}
      </span>
    </>
  );
}

export default function BillingWorkspaceMemberReview({
  member,
  onClose,
}: {
  member: MemberTableRow;
  onClose: () => void;
}) {
  const locale = useLocale();
  const displayLocale = locale.toLowerCase().startsWith("pt") ? "pt-BR" : "en-US";
  const t = useTranslations("admin");
  const period = member.selectedPeriod;
  const financialLabels: Record<FinancialStatus, string> = {
    awaiting_payment: t("ledger.financial.awaitingPayment"),
    no_obligation: t("ledger.financial.noObligation"),
    overdue: t("ledger.financial.overdue"),
    paid: t("ledger.financial.paid"),
    scheduled: t("ledger.financial.scheduled"),
    under_review: t("ledger.financial.underReview"),
  };
  const planLabel =
    member.plan === "annual"
      ? t("plans.annual")
      : member.plan === "monthly"
        ? t("plans.monthly")
        : t("plans.noActivePlan");

  return (
    <div className="flex max-h-[100dvh] flex-col overflow-hidden bg-white">
      <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-5 md:px-7">
        <div className="min-w-0">
          <h2 className="truncate text-xl font-semibold text-slate-950">
            {member.name || t("common.unnamedMember")}
          </h2>
          <p className="truncate text-sm text-slate-500">
            {member.handle ? (
              <Link
                href={`/profile/${member.handle.replace("@", "")}`}
                className="rounded-sm font-medium text-blue-700 underline-offset-2 transition-colors hover:text-blue-800 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
              >
                {member.handle}
              </Link>
            ) : (
              t("common.noHandle")
            )}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <CopyViewLinkButton />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="shrink-0 rounded-lg"
            onClick={onClose}
            aria-label={t("common.closeReview")}
          >
            <X className="size-5" aria-hidden="true" />
          </Button>
        </div>
      </header>

      <div className="scrollbar flex-1 overflow-y-auto px-5 py-5 md:px-7">
        <div className="grid gap-3 sm:grid-cols-2">
          <DetailStat
            label={t("common.contribution")}
            value={`${formatCurrency(period.amount, period.currency, displayLocale)} · ${planLabel}`}
          />
          <DetailStat label={t("common.due")} value={formatDate(period.dueDate, displayLocale)} />
        </div>

        <section className="mt-7 rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <Clock3 className="size-4 text-slate-500" aria-hidden="true" />
            {t("ledgerReview.periodDetail")}
          </div>
          <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
            <DetailField label={t("common.period")}>{period.periodLabel}</DetailField>
            <DetailField label={t("ledgerReview.paymentType")}>
              {period.obligationKind === "initial_admission"
                ? t("purposes.initialAdmission")
                : period.obligationKind === "recurring"
                  ? t("purposes.recurringContribution")
                  : t("ledger.financial.noObligation")}
            </DetailField>
            <DetailField label={t("ledgerReview.available")}>
              {formatDate(period.availableDate, displayLocale)}
            </DetailField>
            <DetailField label={t("ledgerReview.joined")}>
              {formatDate(member.joinedAt, displayLocale)}
            </DetailField>
            {period.claimReason ? (
              <DetailField label={t("common.reason")}>{period.claimReason}</DetailField>
            ) : null}
          </dl>
        </section>

        <section className="mt-7">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <CalendarDays className="size-4 text-slate-500" aria-hidden="true" />
            {t("ledgerReview.recentPeriods")}
          </div>
          {member.history.length > 0 ? (
            <div className="mt-3 divide-y divide-slate-100 rounded-2xl border border-slate-200">
              {member.history.slice(0, 6).map((history) => (
                <div
                  key={`${member.id}-${history.periodKey}`}
                  className="flex items-center justify-between gap-3 px-4 py-3 text-sm"
                >
                  <span className="min-w-0">
                    <span className="block text-slate-600">{history.periodLabel}</span>
                    {/* Only a settled period has a payment time, and that time is
                        the answer to "when did this get paid?" -- so it belongs on
                        the period it settled, not in a single top-level stat. */}
                    {history.paidAt ? (
                      <span className="mt-0.5 block truncate text-xs text-slate-500">
                        {t("ledgerReview.paidAt", {
                          date: formatDateTime(history.paidAt, displayLocale),
                        })}
                      </span>
                    ) : null}
                  </span>
                  <span
                    className={`inline-flex shrink-0 items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${statusTone(history.status)}`}
                  >
                    <span
                      className="mr-1.5 size-1.5 shrink-0 rounded-full bg-current"
                      aria-hidden="true"
                    />
                    {financialLabels[history.status]}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-3 rounded-2xl border border-dashed border-slate-200 px-4 py-5 text-sm text-slate-500">
              {t("ledgerReview.noHistory")}
            </p>
          )}
        </section>
      </div>
    </div>
  );
}

function DetailStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
        {label}
      </p>
      <p className="mt-1 truncate font-semibold tabular-nums text-slate-950">{value}</p>
    </div>
  );
}

function DetailField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="mt-1 font-medium text-slate-800">{children || "—"}</dd>
    </div>
  );
}
