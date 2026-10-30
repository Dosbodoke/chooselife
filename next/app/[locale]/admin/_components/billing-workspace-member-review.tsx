"use client";

import { useQuery } from "@tanstack/react-query";
import { CalendarDays, FileText, UserRound } from "lucide-react";
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
import { Skeleton } from "@/components/ui/skeleton";
import type { WaivableCharge } from "@/lib/contribution-waiver";
import { supabaseBrowser } from "@/utils/supabase/client";

import {
  ApplicationRevisionFields,
  DetailField,
} from "./application-revision-fields";
import BillingWorkspaceContributionWaiver from "./billing-workspace-contribution-waiver";
import BillingWorkspacePaymentReminder from "./billing-workspace-payment-reminder";
import {
  ReviewDrawerBody,
  ReviewDrawerFrame,
  ReviewDrawerHeader,
  ReviewFieldGrid,
  ReviewSection,
} from "./review-drawer";

const supabase = supabaseBrowser();

/** How many periods the history shows before the admin asks for the rest. */
const RECENT_HISTORY_LENGTH = 6;

/** Same "September 2026" shape the real period rows use. */
function monthLabel(dueOn: string, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    month: "long",
    year: "numeric",
  }).format(new Date(`${dueOn.slice(0, 7)}-01T00:00:00`));
}

function statusTone(status: FinancialStatus) {
  if (status === "paid") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "overdue") return "border-red-200 bg-red-50 text-red-700";
  if (status === "rejected") return "border-rose-300 bg-rose-100 text-rose-900";
  if (status === "under_review") return "border-amber-200 bg-amber-50 text-amber-800";
  if (status === "awaiting_payment") return "border-orange-200 bg-orange-50 text-orange-800";
  if (status === "scheduled") return "border-blue-200 bg-blue-50 text-blue-700";
  if (status === "waived") return "border-violet-200 bg-violet-50 text-violet-700";
  return "border-slate-200 bg-slate-50 text-slate-600";
}

export default function BillingWorkspaceMemberReview({
  member,
  onClose,
  organizationId,
  waivableCharges,
}: {
  member: MemberTableRow;
  onClose: () => void;
  organizationId: string | null;
  waivableCharges: WaivableCharge[];
}) {
  const [showFullHistory, setShowFullHistory] = useState(false);
  // Addressed by person, not by claim: this drawer opens on people who have no
  // claim to look up -- long-standing members, ex-members, anyone already decided.
  const detailQuery = useQuery({
    queryKey: ["association-member-detail", organizationId, member.id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc(
        "get_association_member_detail",
        { p_organization_id: organizationId!, p_user_id: member.id },
      );
      if (error) {
        // The drawer shows a single friendly line, which hides the one detail
        // that makes this diagnosable -- e.g. PGRST202 means the function is in
        // Postgres but PostgREST has not reloaded its schema cache.
        console.error("get_association_member_detail failed", error);
        throw error;
      }
      return data?.[0] ?? null;
    },
    enabled: organizationId !== null,
  });
  const detail = detailQuery.data ?? null;
  /**
   * The next charge the member owes. Derived by the RPC rather than read from an
   * obligation, because the generator runs on cron and the upcoming period has
   * no row for most of a cycle -- yet "when is the next payment due" is the
   * question an admin actually gets asked.
   */
  const nextCharge = detail?.next_charge_due_on
    ? {
        amount: detail.next_charge_amount,
        currency: detail.next_charge_currency,
        dueOn: detail.next_charge_due_on,
      }
    : null;
  const locale = useLocale();
  const displayLocale = locale.toLowerCase().startsWith("pt") ? "pt-BR" : "en-US";
  const t = useTranslations("admin");
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
  const visibleHistory = showFullHistory
    ? member.history
    : member.history.slice(0, RECENT_HISTORY_LENGTH);
  const planLabel =
    member.plan === "annual"
      ? t("plans.annual")
      : member.plan === "monthly"
        ? t("plans.monthly")
        : t("plans.noActivePlan");

  return (
    <ReviewDrawerFrame>
      <ReviewDrawerHeader
        onClose={onClose}
        person={{ name: member.name, handle: member.handle }}
      />

      <ReviewDrawerBody>
        {/* Leads the drawer on a financial review: the one action an admin
            takes here, followed by the facts it is based on. Renders nothing
            for somebody who owes nothing. */}
        <BillingWorkspacePaymentReminder
          key={member.id}
          memberId={member.id}
          organizationId={organizationId}
        />

        <BillingWorkspaceContributionWaiver
          key={`waiver-${member.id}`}
          charges={waivableCharges}
          memberId={member.id}
          memberLabel={
            member.name
              ? member.handle
                ? `${member.name} · ${member.handle}`
                : member.name
              : member.handle || t("common.unnamedMember")
          }
          organizationId={organizationId}
        />

        <ReviewSection
          icon={<CalendarDays aria-hidden="true" />}
          title={t("ledgerReview.recentPeriods")}
        >
          {nextCharge || member.history.length > 0 ? (
            <div className="divide-y divide-slate-100 rounded-2xl border border-slate-200">
              {/* Leads the list because it is the only future-dated row, and the
                  rest run newest-first. Derived, so it carries no obligation id
                  and nothing to click into yet. */}
              {nextCharge ? (
                <div className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                  <span className="min-w-0">
                    <span className="block text-slate-600">
                      {monthLabel(nextCharge.dueOn, displayLocale)}
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-slate-500">
                      {t("common.due")} · {formatDate(nextCharge.dueOn, displayLocale)}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-3">
                    <span
                      className={`inline-flex shrink-0 items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${statusTone("scheduled")}`}
                    >
                      <span
                        className="mr-1.5 size-1.5 shrink-0 rounded-full bg-current"
                        aria-hidden="true"
                      />
                      {financialLabels.scheduled}
                    </span>
                    <span className="font-semibold tabular-nums text-slate-900">
                      {formatCurrency(
                        nextCharge.amount,
                        nextCharge.currency ?? undefined,
                        displayLocale,
                      )}
                    </span>
                  </span>
                </div>
              ) : null}
              {visibleHistory.map((history) => (
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
                    {/* A waived month names who forgave it and why, since
                        nothing else on the row explains the missing payment. */}
                    {history.waiver ? (
                      <>
                        <span className="mt-0.5 block text-xs text-slate-500">
                          {history.waiver.waivedByName
                            ? t("ledgerReview.waivedBy", {
                                date: formatDateTime(history.waiver.waivedAt, displayLocale),
                                name: history.waiver.waivedByName,
                              })
                            : t("ledgerReview.waivedAt", {
                                date: formatDateTime(history.waiver.waivedAt, displayLocale),
                              })}
                        </span>
                        <span className="mt-0.5 block break-words text-xs text-slate-500">
                          {t("ledgerReview.waiverReason", {
                            reason: history.waiver.reason,
                          })}
                        </span>
                      </>
                    ) : null}
                  </span>
                  <span className="flex shrink-0 items-center gap-3">
                    <span
                      className={`inline-flex shrink-0 items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${statusTone(history.status)}`}
                    >
                      <span
                        className="mr-1.5 size-1.5 shrink-0 rounded-full bg-current"
                        aria-hidden="true"
                      />
                      {financialLabels[history.status]}
                    </span>
                    {/* Last, so the figures line up as a column the eye can add
                        up. `formatCurrency` renders a void period's null as an
                        em dash rather than R$ 0,00; a waived month keeps its
                        billed amount, struck through because it is not owed. */}
                    <span
                      className={`font-semibold tabular-nums ${history.status === "waived" ? "text-slate-400 line-through" : "text-slate-900"}`}
                    >
                      {formatCurrency(history.amount, history.currency, displayLocale)}
                    </span>
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="rounded-2xl border border-dashed border-slate-200 px-4 py-5 text-sm text-slate-500">
              {t("ledgerReview.noHistory")}
            </p>
          )}
          {member.history.length > RECENT_HISTORY_LENGTH ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="mt-2 rounded-lg text-slate-600"
              aria-expanded={showFullHistory}
              onClick={() => setShowFullHistory((shown) => !shown)}
            >
              {showFullHistory
                ? t("ledgerReview.showRecent")
                : t("ledgerReview.showAll", { count: member.history.length })}
            </Button>
          ) : null}
        </ReviewSection>

        <ReviewSection
          card
          icon={<UserRound aria-hidden="true" />}
          title={t("memberDetail.title")}
        >
          <ReviewFieldGrid>
            <DetailField label={t("memberDetail.memberSince")}>
              {formatDate(detail?.joined_at ?? member.joinedAt, displayLocale)}
            </DetailField>
            <DetailField label={t("common.plan")}>{planLabel}</DetailField>
            {/* Only an ex-member has these, so they appear rather than
                rendering two permanent em dashes for everybody else. */}
            {detail?.departed_at ? (
              <DetailField label={t("memberDetail.departedOn")}>
                {formatDate(detail.departed_at, displayLocale)}
              </DetailField>
            ) : null}
            {detail?.departure_reason ? (
              <DetailField label={t("memberDetail.departureReason")}>
                {detail.departure_reason}
              </DetailField>
            ) : null}
          </ReviewFieldGrid>
        </ReviewSection>

        <ReviewSection
          card
          icon={<FileText aria-hidden="true" />}
          title={t("memberDetail.applicationForm")}
          aside={
            detail?.revision_number
              ? `${t("common.revision", { number: detail.revision_number })}${
                  detail.submitted_at
                    ? ` · ${formatDate(detail.submitted_at, displayLocale)}`
                    : ""
                }`
              : null
          }
        >

          {detailQuery.isPending ? (
            <FieldGridSkeleton label={t("memberDetail.loading")} />
          ) : detailQuery.isError ? (
            <p className="text-sm text-slate-500">
              {t("memberDetail.unavailable")}
            </p>
          ) : detail?.application_revision_id ? (
            <ApplicationRevisionFields handle={member.handle} revision={detail} />
          ) : (
            /* A member admitted before applications existed, or admitted by
               hand, genuinely has no form -- say so instead of showing a grid
               of em dashes. */
            <p className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-5 text-sm text-slate-500">
              {t("memberDetail.noApplication")}
            </p>
          )}
        </ReviewSection>
      </ReviewDrawerBody>
    </ReviewDrawerFrame>
  );
}

/**
 * Stands in for `ApplicationRevisionFields` while it loads, in the same bordered
 * two-column grid -- so the panel does not jump when the data lands.
 *
 * Six pairs, not the real twenty-two: enough to read as "a form is coming"
 * without pretending to know how much of it the person actually filled in.
 */
function FieldGridSkeleton({ label }: { label: string }) {
  return (
    <div
      role="status"
      aria-label={label}
      className="grid gap-x-6 gap-y-4 sm:grid-cols-2"
    >
      {Array.from({ length: 6 }, (_, index) => (
        <div key={index} aria-hidden="true">
          <Skeleton className="h-2.5 w-24" />
          {/* Alternating widths, so the block reads as text rather than as a
              suspiciously tidy table. */}
          <Skeleton
            className={`mt-2 h-3.5 ${index % 3 === 0 ? "w-40" : index % 3 === 1 ? "w-28" : "w-32"}`}
          />
        </div>
      ))}
    </div>
  );
}
