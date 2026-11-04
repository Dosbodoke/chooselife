"use client";

import { CalendarDays, ReceiptText, ShieldCheck } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import {
  ClaimDecisionFooter,
  ClaimResolvedNotice,
} from "@/components/admin/claim-decision-footer";
import type { BillingWorkspaceClaimDetail } from "@/lib/billing-workspace";
import {
  formatBillingAmount,
  formatBillingDate,
  formatBillingDateTime,
  jsonArray,
} from "@/lib/billing-workspace";

import { DetailField } from "./application-revision-fields";
import type { ReviewAction } from "./initial-payment-claim-review";
import {
  ClaimHistoryList,
  ReviewAlert,
  ReviewDrawerBody,
  ReviewDrawerFrame,
  ReviewDrawerHeader,
  ReviewFieldGrid,
  ReviewLoading,
  type ReviewPerson,
  ReviewSection,
} from "./review-drawer";

export default function BillingWorkspaceClaimReview({
  action,
  actionError,
  detail,
  detailLoading,
  onApprove,
  onClose,
  onReject,
  person,
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
  person: ReviewPerson;
  rejectionReason: string;
  onRejectionReasonChange: (value: string) => void;
}) {
  const t = useTranslations("admin");
  const stateLabel = useClaimStateLabel();

  return (
    <ReviewDrawerFrame>
      <ReviewDrawerHeader
        closeDisabled={action !== null}
        onClose={onClose}
        person={person}
      />

      <ReviewDrawerBody>
        {detailLoading ? (
          <ReviewLoading label={t("common.loadingClaimDetails")} />
        ) : !detail ? (
          <ReviewAlert
            title={t("recurringReview.reviewUnavailableTitle")}
            description={actionError || t("recurringReview.refreshWorkspace")}
          />
        ) : (
          <ClaimDetails actionError={actionError} detail={detail} />
        )}
      </ReviewDrawerBody>

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
    </ReviewDrawerFrame>
  );
}

function useClaimStateLabel() {
  const t = useTranslations("admin");

  return (state: string) => {
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
}

function ClaimDetails({
  actionError,
  detail,
}: {
  actionError: string | null;
  detail: BillingWorkspaceClaimDetail;
}) {
  const locale = useLocale();
  const t = useTranslations("admin");
  const stateLabel = useClaimStateLabel();
  const planLabel = !detail.plan_type
    ? t("plans.noActivePlan")
    : detail.plan_type === "annual"
      ? t("plans.annual")
      : t("plans.monthly");
  const claimStates = jsonArray(detail.claim_history).map((history) => ({
    key: String(history.claim_id),
    label: stateLabel(String(history.status)),
    detail: `${formatBillingDateTime(history.created_at, locale)}${
      history.decision_reason ? ` · ${String(history.decision_reason)}` : ""
    }`,
  }));
  const auditEvents = jsonArray(detail.audit_history).map((history) => ({
    key: String(history.id),
    label: `${stateLabel(String(history.previous_state))} → ${stateLabel(
      String(history.next_state),
    )}`,
    detail: `${history.actor_name ? `${String(history.actor_name)} · ` : ""}${formatBillingDateTime(
      history.created_at,
      locale,
    )}${history.reason ? ` · ${String(history.reason)}` : ""}`,
  }));

  return (
    <>
      {actionError ? (
        <ReviewAlert
          title={t("recurringReview.decisionNotCompletedTitle")}
          description={actionError}
        />
      ) : null}

      <ReviewSection
        card
        icon={<ReceiptText aria-hidden="true" />}
        title={t("recurringReview.obligation")}
        aside={detail.organization_name}
      >
        <ReviewFieldGrid>
          <DetailField label={t("common.contribution")}>
            {formatBillingAmount(detail.amount, detail.currency, locale)}
          </DetailField>
          <DetailField label={t("common.plan")}>{planLabel}</DetailField>
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
        </ReviewFieldGrid>
      </ReviewSection>

      <ReviewSection
        card
        icon={<ShieldCheck aria-hidden="true" />}
        title={t("recurringReview.decisionScope")}
      >
        <p className="text-sm text-slate-600">
          {t("recurringReview.decisionScopeDescription")}
        </p>
      </ReviewSection>

      {claimStates.length > 0 || auditEvents.length > 0 ? (
        <ReviewSection
          icon={<CalendarDays aria-hidden="true" />}
          title={t("recurringReview.immutableHistory")}
        >
          <ClaimHistoryList
            claimStates={claimStates}
            claimStatesTitle={t("recurringReview.claimStates")}
            auditEvents={auditEvents}
            auditTitle={t("recurringReview.auditEvents")}
          />
        </ReviewSection>
      ) : null}
    </>
  );
}
