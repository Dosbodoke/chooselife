"use client";

import { AlertTriangle, CalendarDays, Clock3, Loader2, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import {
  ClaimDecisionFooter,
  ClaimResolvedNotice,
} from "@/components/admin/claim-decision-footer";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { BillingWorkspaceClaimDetail } from "@/lib/billing-workspace";
import {
  formatBillingAmount,
  formatBillingDate,
  formatBillingDateTime,
  jsonArray,
} from "@/lib/billing-workspace";

import type { ReviewAction } from "./initial-payment-claim-review";

export default function BillingWorkspaceClaimReview({
  action,
  actionError,
  detail,
  detailLoading,
  onApprove,
  onClose,
  onReject,
  rejectionReason,
  onRejectionReasonChange,
}: {
  action: ReviewAction;
  actionError: string | null;
  detail: BillingWorkspaceClaimDetail | null;
  detailLoading: boolean;
  onApprove: () => Promise<void>;
  onClose: () => void;
  onReject: () => Promise<void>;
  rejectionReason: string;
  onRejectionReasonChange: (value: string) => void;
}) {
  const locale = useLocale();
  const t = useTranslations("admin");
  const stateLabel = (state: string) => {
    if (state === "under_review") return t("states.awaitingReview");
    if (state === "approved") return t("states.approved");
    if (state === "rejected") return t("states.rejected");
    if (state === "scheduled") return t("states.scheduled");
    if (state === "available") return t("states.available");
    if (state === "overdue") return t("states.overdue");
    if (state === "settled") return t("states.settled");
    if (state === "void") return t("states.void");
    return state;
  };
  const planLabel = (plan: BillingWorkspaceClaimDetail["plan_type"]) =>
    !plan
      ? t("plans.noActivePlan")
      : plan === "annual"
        ? t("plans.annual")
        : t("plans.monthly");
  const claimHistory = jsonArray(detail?.claim_history);
  const auditHistory = jsonArray(detail?.audit_history);

  return (
    <div className="flex max-h-[96vh] flex-col overflow-hidden">
      <header className="flex items-center justify-between gap-4 border-b px-5 py-5 md:px-7">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
            {t("recurringReview.eyebrow")}
          </p>
          <h2 className="mt-1 truncate text-xl font-semibold">
            {detail?.member_name || t("common.loadingMember")}
          </h2>
          <p className="truncate text-sm text-muted-foreground">
            {detail?.member_handle || detail?.organization_name || ""}
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onClose}
          disabled={action !== null}
          aria-label={t("common.closeReview")}
          className="shrink-0 rounded-xl"
        >
          <X className="size-5" aria-hidden="true" />
        </Button>
      </header>

      <div className="scrollbar overflow-y-auto px-5 py-5 md:px-7 md:py-6">
        {detailLoading ? (
          <div className="flex min-h-72 items-center justify-center">
            <Loader2
              className="size-7 animate-spin text-muted-foreground"
              aria-label={t("common.loadingClaimDetails")}
            />
          </div>
        ) : !detail ? (
          <div className="flex min-h-72 items-center justify-center">
            <Alert variant="destructive" className="max-w-lg">
              <AlertTriangle className="size-4" aria-hidden="true" />
              <AlertTitle>{t("recurringReview.reviewUnavailableTitle")}</AlertTitle>
              <AlertDescription>
                {actionError || t("recurringReview.refreshWorkspace")}
              </AlertDescription>
            </Alert>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">
                <Clock3 className="mr-1.5 size-3.5" aria-hidden="true" />
                {detail.claim_status === "under_review"
                  ? t("states.awaitingReview")
                  : stateLabel(detail.claim_status)}
              </Badge>
              <Badge variant="secondary">{detail.organization_name}</Badge>
            </div>

            {actionError ? (
              <Alert variant="destructive" aria-live="assertive">
                <AlertTriangle className="size-4" aria-hidden="true" />
              <AlertTitle>
                {t("recurringReview.decisionNotCompletedTitle")}
              </AlertTitle>
                <AlertDescription>{actionError}</AlertDescription>
              </Alert>
            ) : null}

            <div className="grid gap-3 sm:grid-cols-3">
              <SummaryCard
                label={t("common.contribution")}
                value={formatBillingAmount(detail.amount, detail.currency, locale)}
              />
              <SummaryCard label={t("common.plan")} value={planLabel(detail.plan_type)} />
              <SummaryCard
                label={t("common.submitted")}
                value={formatBillingDateTime(detail.claim_created_at, locale)}
              />
            </div>

            <section aria-labelledby="recurring-obligation-title">
              <SectionHeading
                id="recurring-obligation-title"
                icon={<CalendarDays className="size-4" aria-hidden="true" />}
                title={t("recurringReview.obligation")}
              />
              <div className="mt-3 grid gap-x-6 gap-y-4 rounded-2xl border bg-muted/20 p-4 sm:grid-cols-2">
                <DetailField label={t("common.period")}>{detail.period_key}</DetailField>
                <DetailField label={t("common.payer")}>
                  {detail.payer_type === "applicant"
                    ? t("common.member")
                    : detail.payer_name || t("common.otherPayer")}
                </DetailField>
                <DetailField label={t("recurringReview.periodStart")}>
                  {formatBillingDate(detail.period_start, locale)}
                </DetailField>
                <DetailField label={t("recurringReview.periodEnd")}>
                  {formatBillingDate(detail.period_end, locale)}
                </DetailField>
                <DetailField label={t("recurringReview.availableOn")}>
                  {formatBillingDate(detail.available_on, locale)}
                </DetailField>
                <DetailField label={t("recurringReview.dueOn")}>
                  {formatBillingDate(detail.due_on, locale)}
                </DetailField>
                <DetailField label={t("common.claimAttempts")}>
                  {detail.attempt_count}
                </DetailField>
                <DetailField label={t("common.claimSubmitted")}>
                  {formatBillingDateTime(detail.claim_created_at, locale)}
                </DetailField>
              </div>
            </section>

            <section aria-labelledby="recurring-safety-title" className="rounded-2xl border border-primary/20 bg-primary/5 p-4">
              <h3 id="recurring-safety-title" className="font-semibold">
                {t("recurringReview.decisionScope")}
              </h3>
              <p className="mt-2 text-sm text-muted-foreground">
                {t("recurringReview.decisionScopeDescription")}
              </p>
            </section>

            {claimHistory.length > 0 || auditHistory.length > 0 ? (
              <section aria-labelledby="recurring-history-title">
                <SectionHeading
                  id="recurring-history-title"
                  icon={<CalendarDays className="size-4" aria-hidden="true" />}
                  title={t("recurringReview.immutableHistory")}
                />
                <div className="mt-3 grid gap-3 rounded-2xl border bg-muted/20 p-4 lg:grid-cols-2">
                  <HistoryColumn title={t("recurringReview.claimStates")}>
                    {claimHistory.map((history) => (
                      <div
                        key={String(history.claim_id)}
                        className="flex flex-wrap items-center justify-between gap-2 text-sm"
                      >
                          <span className="font-medium">
                            {stateLabel(String(history.status))}
                          </span>
                        <span className="text-muted-foreground">
                          {formatBillingDateTime(history.created_at, locale)}
                          {history.decision_reason
                            ? ` · ${String(history.decision_reason)}`
                            : ""}
                        </span>
                      </div>
                    ))}
                  </HistoryColumn>
                  <HistoryColumn title={t("recurringReview.auditEvents")}>
                    {auditHistory.map((history) => (
                      <div
                        key={String(history.id)}
                        className="flex flex-wrap items-center justify-between gap-2 text-sm"
                      >
                        <span className="font-medium">
                          {stateLabel(String(history.previous_state))} →{" "}
                          {stateLabel(String(history.next_state))}
                        </span>
                        <span className="text-muted-foreground">
                          {history.actor_name ? `${String(history.actor_name)} · ` : ""}
                          {formatBillingDateTime(history.created_at, locale)}
                          {history.reason ? ` · ${String(history.reason)}` : ""}
                        </span>
                      </div>
                    ))}
                  </HistoryColumn>
                </div>
              </section>
            ) : null}
          </div>
        )}
      </div>

      {!detail ? null : detail.claim_status !== "under_review" ? (
        <ClaimResolvedNotice
          status={detail.claim_status}
          message={t("recurringReview.resolvedMessage", {
            status: stateLabel(detail.claim_status),
          })}
        />
      ) : (
        <ClaimDecisionFooter
          action={action}
          reasonInputId="recurring-rejection-reason"
          copy={{
            approve: t("recurringReview.confirmPayment"),
            cancel: t("common.cancel"),
            confirmRejection: t("recurringReview.confirmRejection"),
            reject: t("recurringReview.rejectClaim"),
            rejectionPlaceholder: t("recurringReview.rejectionPlaceholder"),
            rejectionReason: t("recurringReview.rejectionReason"),
          }}
          onApprove={onApprove}
          onReject={onReject}
          rejectionReason={rejectionReason}
          onRejectionReasonChange={onRejectionReasonChange}
        />
      )}
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border bg-card p-4 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-2 truncate font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function DetailField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-1 font-medium">{children || "—"}</dd>
    </div>
  );
}

function SectionHeading({
  icon,
  id,
  title,
}: {
  icon: React.ReactNode;
  id: string;
  title: string;
}) {
  return (
    <h3 id={id} className="flex items-center gap-2 font-semibold">
      {icon}
      {title}
    </h3>
  );
}

function HistoryColumn({
  children,
  title,
}: {
  children: React.ReactNode;
  title: string;
}) {
  return (
    <div className="space-y-2 rounded-xl border bg-background p-3">
      <h4 className="text-sm font-semibold">{title}</h4>
      {children}
    </div>
  );
}
