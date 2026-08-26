"use client";

import { useQuery } from "@tanstack/react-query";
import { CalendarDays, Check, FileText, Link2, UserRound, X } from "lucide-react";
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
import { Link } from "@/i18n/navigation";
import { supabaseBrowser } from "@/utils/supabase/client";

import {
  ApplicationRevisionFields,
  DetailField,
} from "./application-revision-fields";

const supabase = supabaseBrowser();

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
  organizationId,
}: {
  member: MemberTableRow;
  onClose: () => void;
  organizationId: string | null;
}) {
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
        <section className="mt-7 rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <UserRound className="size-4 text-slate-500" aria-hidden="true" />
            {t("memberDetail.title")}
          </div>

          <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
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
          </dl>

          <div className="mt-6 flex items-center gap-2 text-sm font-semibold text-slate-900">
            <FileText className="size-4 text-slate-500" aria-hidden="true" />
            {t("memberDetail.applicationForm")}
            {detail?.revision_number ? (
              <span className="text-xs font-medium text-slate-500">
                {t("common.revision", { number: detail.revision_number })}
                {detail.submitted_at
                  ? ` · ${formatDate(detail.submitted_at, displayLocale)}`
                  : ""}
              </span>
            ) : null}
          </div>

          {detailQuery.isPending ? (
            <FieldGridSkeleton label={t("memberDetail.loading")} />
          ) : detailQuery.isError ? (
            <p className="mt-3 text-sm text-slate-500">
              {t("memberDetail.unavailable")}
            </p>
          ) : detail?.application_revision_id ? (
            <div className="mt-3">
              <ApplicationRevisionFields handle={member.handle} revision={detail} />
            </div>
          ) : (
            /* A member admitted before applications existed, or admitted by
               hand, genuinely has no form -- say so instead of showing a grid
               of em dashes. */
            <p className="mt-3 rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-5 text-sm text-slate-500">
              {t("memberDetail.noApplication")}
            </p>
          )}
        </section>

        <section className="mt-7">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <CalendarDays className="size-4 text-slate-500" aria-hidden="true" />
            {t("ledgerReview.recentPeriods")}
          </div>
          {nextCharge || member.history.length > 0 ? (
            <div className="mt-3 divide-y divide-slate-100 rounded-2xl border border-slate-200">
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
                        em dash rather than R$ 0,00. */}
                    <span className="font-semibold tabular-nums text-slate-900">
                      {formatCurrency(history.amount, history.currency, displayLocale)}
                    </span>
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
      className="mt-3 grid gap-x-6 gap-y-4 rounded-2xl border bg-muted/20 p-4 sm:grid-cols-2"
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
