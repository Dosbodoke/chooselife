"use client";

import { CalendarDays, Clock3, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import {
  type FinancialStatus,
  formatCurrency,
  formatDate,
  formatDateTime,
  type LifecycleStatus,
  type MemberTableRow,
} from "@/components/admin/member-ledger";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

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

  return (
    <div className="flex max-h-[100dvh] flex-col overflow-hidden bg-white">
      <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-5 md:px-7">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
            {t("ledgerReview.eyebrow")}
          </p>
          <h2 className="mt-1 truncate text-xl font-semibold text-slate-950">
            {member.name || t("common.unnamedMember")}
          </h2>
          <p className="truncate text-sm text-slate-500">
            {member.handle || t("common.noHandle")} · {lifecycleLabels[member.lifecycle]}
          </p>
        </div>
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
      </header>

      <div className="scrollbar flex-1 overflow-y-auto px-5 py-5 md:px-7">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="border-slate-200 bg-white text-slate-700">
            {lifecycleLabels[member.lifecycle]}
          </Badge>
          <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-600">
            {financialLabels[period.status]}
          </Badge>
          <span className="text-xs text-slate-500">{period.periodLabel}</span>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <DetailStat
            label={t("common.contribution")}
            value={formatCurrency(period.amount, period.currency, displayLocale)}
          />
          <DetailStat label={t("common.due")} value={formatDate(period.dueDate, displayLocale)} />
          <DetailStat
            label={t("common.lastVerifiedContribution")}
            value={formatDateTime(member.lastVerifiedContributionAt, displayLocale)}
          />
        </div>

        <section className="mt-7 rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <Clock3 className="size-4 text-slate-500" aria-hidden="true" />
            {t("ledgerReview.periodDetail")}
          </div>
          <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
            <DetailField label={t("common.period")}>{period.periodLabel}</DetailField>
            <DetailField label={t("common.plan")}>
              {member.plan === "annual"
                ? t("plans.annual")
                : member.plan === "monthly"
                  ? t("plans.monthly")
                  : t("plans.noActivePlan")}
            </DetailField>
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
                  <span className="text-slate-600">{history.periodLabel}</span>
                  <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-600">
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
