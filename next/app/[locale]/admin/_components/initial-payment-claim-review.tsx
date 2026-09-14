"use client";

import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  Clock3,
  FileText,
  Loader2,
  UserRound,
  X,
} from "lucide-react";
import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import type { ReactNode } from "react";

import {
  ClaimDecisionFooter,
  ClaimResolvedNotice,
} from "@/components/admin/claim-decision-footer";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type {
  InitialPaymentClaimDetail,
  InitialPaymentClaimQueueRow,
} from "@/lib/initial-payment-claims";

import {
  ApplicationRevisionFields,
  DetailField,
} from "./application-revision-fields";
import { formatAmount, formatDate } from "./initial-payment-claim-formatters";

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
  rejectionReason: string;
  onRejectionReasonChange: (value: string) => void;
}) {
  return (
    <div className="flex h-full flex-col overflow-hidden bg-background">
      <ReviewHeader action={action} detail={detail} onClose={onClose} />
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
    </div>
  );
}

function ReviewHeader({
  action,
  detail,
  onClose,
}: {
  action: ReviewAction;
  detail: InitialPaymentClaimDetail | null;
  onClose: () => void;
}) {
  const t = useTranslations("admin");

  return (
    <div className="flex items-start justify-between gap-4 border-b px-5 py-5 md:px-7">
      <div className="flex min-w-0 items-center gap-3">
        {detail ? (
          <ApplicantAvatar
            name={detail.applicant_name}
            handle={detail.applicant_handle}
            picture={detail.applicant_profile_picture}
          />
        ) : (
          <span className="flex size-14 shrink-0 items-center justify-center rounded-full bg-muted">
            <UserRound
              className="size-6 text-muted-foreground"
              aria-hidden="true"
            />
          </span>
        )}
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
            {t("initialReview.eyebrow")}
          </p>
          <h2 className="mt-1 truncate text-xl font-semibold">
            {detail?.applicant_name || t("common.loadingApplicant")}
          </h2>
          <p className="truncate text-sm text-muted-foreground">
            {detail?.applicant_handle || detail?.organization_name || ""}
          </p>
        </div>
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
    </div>
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
  const claimHistory = getHistory(detail?.claim_history);
  const auditHistory = getHistory(detail?.audit_history);

  return (
    <div className="scrollbar min-h-0 flex-1 overflow-y-auto px-5 py-5 md:px-7 md:py-6">
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
            <AlertTitle>{t("initialReview.reviewUnavailableTitle")}</AlertTitle>
            <AlertDescription>
              {actionError || t("initialReview.refreshQueue")}
            </AlertDescription>
          </Alert>
        </div>
      ) : (
        <div className="space-y-6">
          {actionError ? (
            <Alert variant="destructive" aria-live="assertive">
              <AlertTriangle className="size-4" aria-hidden="true" />
              <AlertTitle>
                {t("initialReview.decisionNotCompletedTitle")}
              </AlertTitle>
              <AlertDescription>{actionError}</AlertDescription>
            </Alert>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2">
            <SummaryCard
              label={t("common.claimAmount")}
              value={`${formatAmount(detail.amount, detail.currency, locale)} · ${
                detail.plan_type === "annual"
                  ? t("plans.annual")
                  : t("plans.monthly")
              }`}
            />
            <SummaryCard
              label={t("common.submitted")}
              value={formatDate(detail.claim_created_at, locale)}
            />
          </div>

          <section aria-labelledby="payment-evidence-title">
            <SectionHeading
              id="payment-evidence-title"
              icon={<CheckCircle2 className="size-4" aria-hidden="true" />}
              title={t("initialReview.paymentEvidence")}
            />
            <div className="mt-3 grid gap-x-6 gap-y-4 rounded-2xl border bg-muted/20 p-4 sm:grid-cols-2">
              <DetailField label={t("common.payer")}>
                {detail.payer_type === "applicant"
                  ? t("common.applicant")
                  : detail.payer_name || t("common.otherPayer")}
              </DetailField>
              <DetailField label={t("common.claimAttempts")}>
                {detail.attempt_count}
              </DetailField>
              <DetailField label={t("common.claimCreated")}>
                {formatDate(detail.claim_created_at, locale)}
              </DetailField>
              <DetailField label={t("common.termsVersion")}>
                {detail.terms_version}
              </DetailField>
            </div>
          </section>

          <ApplicationRevision detail={detail} />

          {claimHistory.length > 0 || auditHistory.length > 0 ? (
            <ClaimHistory
              claimHistory={claimHistory}
              auditHistory={auditHistory}
            />
          ) : null}
        </div>
      )}
    </div>
  );
}

function ApplicationRevision({
  detail,
}: {
  detail: InitialPaymentClaimDetail;
}) {
  const t = useTranslations("admin");

  return (
    <section aria-labelledby="application-title">
      <SectionHeading
        id="application-title"
        icon={<FileText className="size-4" aria-hidden="true" />}
        title={t("initialReview.applicationRevision")}
      />
      <div className="mt-3">
        <ApplicationRevisionFields
          handle={detail.applicant_handle}
          revision={detail}
        />
      </div>
    </section>
  );
}

function ClaimHistory({
  auditHistory,
  claimHistory,
}: {
  auditHistory: Record<string, unknown>[];
  claimHistory: Record<string, unknown>[];
}) {
  const locale = useLocale();
  const t = useTranslations("admin");
  const stateLabel = (status: string) => {
    if (status === "under_review") return t("states.underReview");
    if (status === "approved") return t("states.approved");
    if (status === "rejected") return t("states.rejected");
    return status;
  };

  return (
    <section aria-labelledby="history-title">
      <SectionHeading
        id="history-title"
        icon={<CalendarDays className="size-4" aria-hidden="true" />}
        title={t("initialReview.immutableHistory")}
      />
      <div className="mt-3 grid gap-3 rounded-2xl border bg-muted/20 p-4 lg:grid-cols-2">
        <HistoryColumn title={t("initialReview.claimStates")}>
          {claimHistory.map((history) => (
            <div
              key={String(history.claim_id)}
              className="flex flex-wrap items-center justify-between gap-2 text-sm"
            >
              <span className="font-medium">
                {stateLabel(String(history.status))}
              </span>
              <span className="text-muted-foreground">
                {formatDate(String(history.created_at), locale)}
                {history.decision_reason
                  ? ` · ${String(history.decision_reason)}`
                  : ""}
              </span>
            </div>
          ))}
        </HistoryColumn>
        <HistoryColumn title={t("initialReview.auditEvents")}>
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
                {formatDate(String(history.created_at), locale)}
                {history.reason ? ` · ${String(history.reason)}` : ""}
              </span>
            </div>
          ))}
        </HistoryColumn>
      </div>
    </section>
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

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
        {label}
      </p>
      <p className="mt-1 truncate font-semibold tabular-nums text-slate-950">
        {value}
      </p>
    </div>
  );
}

function SectionHeading({
  icon,
  id,
  title,
}: {
  icon: ReactNode;
  id: string;
  title: string;
}) {
  return (
    <h3 id={id} className="flex items-center gap-2 text-sm font-semibold">
      <span className="text-muted-foreground">{icon}</span>
      {title}
    </h3>
  );
}

function HistoryColumn({
  children,
  title,
}: {
  children: ReactNode;
  title: string;
}) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">
        {title}
      </p>
      <div className="mt-2 space-y-2">{children}</div>
    </div>
  );
}
