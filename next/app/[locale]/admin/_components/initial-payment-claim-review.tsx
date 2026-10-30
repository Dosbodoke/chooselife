"use client";

import { CalendarDays, CheckCircle2, Clock3, FileText } from "lucide-react";
import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";

import {
  ClaimDecisionFooter,
  ClaimResolvedNotice,
} from "@/components/admin/claim-decision-footer";
import { Badge } from "@/components/ui/badge";
import type {
  InitialPaymentClaimDetail,
  InitialPaymentClaimQueueRow,
} from "@/lib/initial-payment-claims";

import {
  ApplicationRevisionFields,
  DetailField,
} from "./application-revision-fields";
import { formatAmount, formatDate } from "./initial-payment-claim-formatters";
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

function getInitials(name: string | null, handle: string | null) {
  const source = name?.trim() || handle?.replace(/^@/, "") || "A";
  const initials = source
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

  return initials || "A";
}

function getHistory(value: unknown) {
  return Array.isArray(value)
    ? value.filter(
        (entry): entry is Record<string, unknown> =>
          typeof entry === "object" && entry !== null,
      )
    : [];
}

export function QueueStatusBadge({
  status,
}: {
  status: InitialPaymentClaimQueueRow["claim_status"];
}) {
  const t = useTranslations("admin");
  const statusLabel =
    status === "under_review"
      ? t("states.awaitingReview")
      : status === "approved"
        ? t("states.approved")
        : t("states.rejected");

  return (
    <Badge
      variant="outline"
      className="border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300"
    >
      <Clock3 className="mr-1.5 size-3.5" aria-hidden="true" />
      {statusLabel}
    </Badge>
  );
}

export function ApplicantAvatar({
  name,
  handle,
  picture,
  size = "md",
}: {
  name: string | null;
  handle: string | null;
  picture: string | null;
  size?: "sm" | "md";
}) {
  const sizeClass = size === "sm" ? "size-10 text-sm" : "size-14 text-base";

  return (
    <div
      className={`relative flex ${sizeClass} shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted font-semibold text-muted-foreground outline outline-1 outline-black/10 dark:outline-white/10`}
    >
      {picture ? (
        <Image
          src={picture}
          alt=""
          fill
          sizes={size === "sm" ? "40px" : "56px"}
          className="object-cover"
          loading="lazy"
        />
      ) : (
        getInitials(name, handle)
      )}
    </div>
  );
}

export type ReviewAction = "approve" | "reject" | null;

export function InitialPaymentClaimReview({
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
  detail: InitialPaymentClaimDetail | null;
  detailLoading: boolean;
  onApprove: () => Promise<void>;
  onClose: () => void;
  onReject: () => Promise<void>;
  person: ReviewPerson;
  rejectionReason: string;
  onRejectionReasonChange: (value: string) => void;
}) {
  return (
    <ReviewDrawerFrame>
      <ReviewDrawerHeader
        closeDisabled={action !== null}
        onClose={onClose}
        person={person}
      />
      <ReviewDetails
        actionError={actionError}
        detail={detail}
        detailLoading={detailLoading}
      />
      <ReviewActions
        action={action}
        detail={detail}
        onApprove={onApprove}
        onReject={onReject}
        rejectionReason={rejectionReason}
        onRejectionReasonChange={onRejectionReasonChange}
      />
    </ReviewDrawerFrame>
  );
}

function ReviewDetails({
  actionError,
  detail,
  detailLoading,
}: {
  actionError: string | null;
  detail: InitialPaymentClaimDetail | null;
  detailLoading: boolean;
}) {
  const locale = useLocale();
  const t = useTranslations("admin");

  if (detailLoading) {
    return (
      <ReviewDrawerBody>
        <ReviewLoading label={t("common.loadingClaimDetails")} />
      </ReviewDrawerBody>
    );
  }

  if (!detail) {
    return (
      <ReviewDrawerBody>
        <ReviewAlert
          title={t("initialReview.reviewUnavailableTitle")}
          description={actionError || t("initialReview.refreshQueue")}
        />
      </ReviewDrawerBody>
    );
  }

  const stateLabel = (status: string) => {
    if (status === "under_review") return t("states.underReview");
    if (status === "approved") return t("states.approved");
    if (status === "rejected") return t("states.rejected");
    return status;
  };
  const claimStates = getHistory(detail.claim_history).map((history) => ({
    key: String(history.claim_id),
    label: stateLabel(String(history.status)),
    detail: `${formatDate(String(history.created_at), locale)}${
      history.decision_reason ? ` · ${String(history.decision_reason)}` : ""
    }`,
  }));
  const auditEvents = getHistory(detail.audit_history).map((history) => ({
    key: String(history.id),
    label: `${stateLabel(String(history.previous_state))} → ${stateLabel(
      String(history.next_state),
    )}`,
    detail: `${formatDate(String(history.created_at), locale)}${
      history.reason ? ` · ${String(history.reason)}` : ""
    }`,
  }));

  return (
    <ReviewDrawerBody>
      {actionError ? (
        <ReviewAlert
          title={t("initialReview.decisionNotCompletedTitle")}
          description={actionError}
        />
      ) : null}

      <ReviewSection
        card
        icon={<CheckCircle2 aria-hidden="true" />}
        title={t("initialReview.paymentEvidence")}
      >
        <ReviewFieldGrid>
          <DetailField label={t("common.claimAmount")}>
            {`${formatAmount(detail.amount, detail.currency, locale)} · ${
              detail.plan_type === "annual"
                ? t("plans.annual")
                : t("plans.monthly")
            }`}
          </DetailField>
          <DetailField label={t("common.submitted")}>
            {formatDate(detail.claim_created_at, locale)}
          </DetailField>
          <DetailField label={t("common.payer")}>
            {detail.payer_type === "applicant"
              ? t("common.applicant")
              : detail.payer_name || t("common.otherPayer")}
          </DetailField>
          <DetailField label={t("common.claimAttempts")}>
            {detail.attempt_count}
          </DetailField>
          <DetailField label={t("common.termsVersion")}>
            {detail.terms_version}
          </DetailField>
        </ReviewFieldGrid>
      </ReviewSection>

      <ReviewSection
        card
        icon={<FileText aria-hidden="true" />}
        title={t("initialReview.applicationRevision")}
      >
        <ApplicationRevisionFields
          handle={detail.applicant_handle}
          revision={detail}
        />
      </ReviewSection>

      {claimStates.length > 0 || auditEvents.length > 0 ? (
        <ReviewSection
          icon={<CalendarDays aria-hidden="true" />}
          title={t("initialReview.immutableHistory")}
        >
          <ClaimHistoryList
            claimStates={claimStates}
            claimStatesTitle={t("initialReview.claimStates")}
            auditEvents={auditEvents}
            auditTitle={t("initialReview.auditEvents")}
          />
        </ReviewSection>
      ) : null}
    </ReviewDrawerBody>
  );
}

function ReviewActions({
  action,
  detail,
  onApprove,
  onReject,
  rejectionReason,
  onRejectionReasonChange,
}: {
  action: ReviewAction;
  detail: InitialPaymentClaimDetail | null;
  onApprove: () => Promise<void>;
  onReject: () => Promise<void>;
  rejectionReason: string;
  onRejectionReasonChange: (value: string) => void;
}) {
  const t = useTranslations("admin");

  if (!detail) return null;

  if (detail.claim_status !== "under_review") {
    return (
      <ClaimResolvedNotice
        status={detail.claim_status}
        message={t("initialReview.resolvedMessage", {
          status:
            detail.claim_status === "approved"
              ? t("states.approved")
              : t("states.rejected"),
        })}
      />
    );
  }

  return (
    <ClaimDecisionFooter
      action={action}
      reasonInputId="rejection-reason"
      copy={{
        approve: t("initialReview.confirmEnrollment"),
        cancel: t("common.cancel"),
        confirmRejection: t("initialReview.confirmRejection"),
        reject: t("initialReview.rejectClaim"),
        rejectionPlaceholder: t("initialReview.rejectionPlaceholder"),
        rejectionReason: t("initialReview.rejectionReason"),
      }}
      onApprove={onApprove}
      onReject={onReject}
      rejectionReason={rejectionReason}
      onRejectionReasonChange={onRejectionReasonChange}
    />
  );
}
