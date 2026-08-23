import Image from "next/image";
import {
  AlertTriangle,
  CalendarDays,
  Check,
  CheckCircle2,
  Clock3,
  FileText,
  Loader2,
  UserRound,
  X,
  XCircle,
} from "lucide-react";
import type { ReactNode } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type {
  InitialPaymentClaimDetail,
  InitialPaymentClaimQueueRow,
} from "@/lib/initial-payment-claims";

import { formatAmount, formatDate } from "./initial-payment-claim-formatters";

function getInitials(name: string | null, handle: string | null) {
  const source = name?.trim() || handle?.replace(/^@/, "") || "Applicant";
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
  return (
    <Badge
      variant="outline"
      className="border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300"
    >
      <Clock3 className="mr-1.5 size-3.5" aria-hidden="true" />
      {status === "under_review" ? "Awaiting review" : status}
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
    <div className="flex max-h-[90vh] flex-col bg-background">
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
            Initial claim review
          </p>
          <h2 className="mt-1 truncate text-xl font-semibold">
            {detail?.applicant_name || "Loading applicant"}
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
        aria-label="Close review"
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
  const claimHistory = getHistory(detail?.claim_history);
  const auditHistory = getHistory(detail?.audit_history);

  return (
    <div className="scrollbar overflow-y-auto px-5 py-5 md:px-7 md:py-6">
      {detailLoading ? (
        <div className="flex min-h-72 items-center justify-center">
          <Loader2
            className="size-7 animate-spin text-muted-foreground"
            aria-label="Loading claim details"
          />
        </div>
      ) : !detail ? (
        <div className="flex min-h-72 items-center justify-center">
          <Alert variant="destructive" className="max-w-lg">
            <AlertTriangle className="size-4" aria-hidden="true" />
            <AlertTitle>Review unavailable</AlertTitle>
            <AlertDescription>
              {actionError || "Refresh the queue and try again."}
            </AlertDescription>
          </Alert>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center gap-2">
            <QueueStatusBadge status={detail.claim_status} />
            <Badge variant="secondary">Revision {detail.revision_number}</Badge>
            <Badge variant="secondary">{detail.organization_name}</Badge>
          </div>

          {actionError ? (
            <Alert variant="destructive" aria-live="assertive">
              <AlertTriangle className="size-4" aria-hidden="true" />
              <AlertTitle>Decision not completed</AlertTitle>
              <AlertDescription>{actionError}</AlertDescription>
            </Alert>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-3">
            <SummaryCard
              label="Claim amount"
              value={formatAmount(detail.amount, detail.currency)}
            />
            <SummaryCard
              label="Plan"
              value={detail.plan_type === "annual" ? "Annual" : "Monthly"}
            />
            <SummaryCard
              label="Submitted"
              value={formatDate(detail.claim_created_at)}
            />
          </div>

          <section aria-labelledby="payment-evidence-title">
            <SectionHeading
              id="payment-evidence-title"
              icon={<CheckCircle2 className="size-4" aria-hidden="true" />}
              title="Payment evidence"
            />
            <div className="mt-3 grid gap-x-6 gap-y-4 rounded-2xl border bg-muted/20 p-4 sm:grid-cols-2">
              <DetailField label="Payer">
                {detail.payer_type === "applicant"
                  ? "Applicant"
                  : detail.payer_name || "Other payer"}
              </DetailField>
              <DetailField label="Claim attempts">
                {detail.attempt_count}
              </DetailField>
              <DetailField label="Claim created">
                {formatDate(detail.claim_created_at)}
              </DetailField>
              <DetailField label="Terms version">
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
  return (
    <section aria-labelledby="application-title">
      <SectionHeading
        id="application-title"
        icon={<FileText className="size-4" aria-hidden="true" />}
        title="Submitted application revision"
      />
      <div className="mt-3 grid gap-x-6 gap-y-4 rounded-2xl border bg-muted/20 p-4 sm:grid-cols-2">
        <DetailField label="Full name">{detail.full_name}</DetailField>
        <DetailField label="Handle">{detail.applicant_handle}</DetailField>
        <DetailField label="Birth date">{detail.birth_date}</DetailField>
        <DetailField label="Nationality">{detail.nationality}</DetailField>
        <DetailField label="Marital status">
          {detail.marital_status}
        </DetailField>
        <DetailField label="Profession">{detail.profession}</DetailField>
        <DetailField label="Birthplace">{detail.birthplace}</DetailField>
        <DetailField label="Email">{detail.email}</DetailField>
        <DetailField label="Phone">{detail.phone}</DetailField>
        <DetailField label="CPF">{detail.cpf}</DetailField>
        <DetailField label="ID document">
          {detail.id_document_number}
        </DetailField>
        <DetailField label="Issuing authority">
          {detail.id_document_issuer}
        </DetailField>
        <DetailField label="Postal code">{detail.postal_code}</DetailField>
        <DetailField label="Address">{detail.address_line}</DetailField>
        <DetailField label="City / state">
          {[detail.city, detail.state].filter(Boolean).join(" / ")}
        </DetailField>
        <DetailField label="Blood type">{detail.blood_type}</DetailField>
        <DetailField label="Allergies">
          {detail.has_allergies ? detail.allergies : "None reported"}
        </DetailField>
        <DetailField label="Dietary restrictions">
          {detail.has_dietary_restrictions
            ? detail.dietary_restrictions
            : "None reported"}
        </DetailField>
        <DetailField label="Highline experience">
          {detail.highline_experience}
        </DetailField>
        <DetailField label="Rescue course">
          {detail.has_rescue_course ? "Yes" : "No"}
        </DetailField>
        <DetailField label="First-aid course">
          {detail.first_aid_course}
        </DetailField>
        <DetailField label="Emergency contact">
          {[
            detail.emergency_contact_name,
            detail.emergency_contact_relationship,
            detail.emergency_contact_phone,
          ]
            .filter(Boolean)
            .join(" · ")}
        </DetailField>
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
  return (
    <section aria-labelledby="history-title">
      <SectionHeading
        id="history-title"
        icon={<CalendarDays className="size-4" aria-hidden="true" />}
        title="Immutable history"
      />
      <div className="mt-3 grid gap-3 rounded-2xl border bg-muted/20 p-4 lg:grid-cols-2">
        <HistoryColumn title="Claim states">
          {claimHistory.map((history) => (
            <div
              key={String(history.claim_id)}
              className="flex flex-wrap items-center justify-between gap-2 text-sm"
            >
              <span className="font-medium">{String(history.status)}</span>
              <span className="text-muted-foreground">
                {formatDate(String(history.created_at))}
                {history.decision_reason
                  ? ` · ${String(history.decision_reason)}`
                  : ""}
              </span>
            </div>
          ))}
        </HistoryColumn>
        <HistoryColumn title="Audit events">
          {auditHistory.map((history) => (
            <div
              key={String(history.id)}
              className="flex flex-wrap items-center justify-between gap-2 text-sm"
            >
              <span className="font-medium">
                {String(history.previous_state)} → {String(history.next_state)}
              </span>
              <span className="text-muted-foreground">
                {formatDate(String(history.created_at))}
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
  if (!detail) return null;

  if (detail.claim_status !== "under_review") {
    return (
      <div className="border-t bg-muted/20 px-5 py-4 md:px-7">
        <div className="flex items-start gap-3 text-sm text-muted-foreground">
          {detail.claim_status === "approved" ? (
            <CheckCircle2
              className="mt-0.5 size-5 shrink-0 text-emerald-600"
              aria-hidden="true"
            />
          ) : (
            <XCircle
              className="mt-0.5 size-5 shrink-0 text-destructive"
              aria-hidden="true"
            />
          )}
          <p>
            This claim is {detail.claim_status}. The authoritative state has
            been preserved; close this review and refresh the queue.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="border-t bg-card px-5 py-4 md:px-7">
      <label htmlFor="rejection-reason" className="text-sm font-medium">
        Rejection reason
        <span className="ml-1 text-destructive" aria-hidden="true">
          *
        </span>
      </label>
      <Textarea
        id="rejection-reason"
        value={rejectionReason}
        onChange={(event) => onRejectionReasonChange(event.target.value)}
        maxLength={500}
        placeholder="Explain what the applicant needs to correct."
        className="mt-2 min-h-20 rounded-xl"
        disabled={action !== null}
      />
      <div className="mt-3 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button
          type="button"
          variant="destructive"
          onClick={() => void onReject()}
          disabled={action !== null}
          className="h-11 rounded-xl px-5 active:scale-[0.96]"
        >
          {action === "reject" ? (
            <Loader2 className="mr-2 size-4 animate-spin" aria-hidden="true" />
          ) : (
            <XCircle className="mr-2 size-4" aria-hidden="true" />
          )}
          Reject claim
        </Button>
        <Button
          type="button"
          onClick={() => void onApprove()}
          disabled={action !== null}
          className="h-11 rounded-xl px-5 active:scale-[0.96]"
        >
          {action === "approve" ? (
            <Loader2 className="mr-2 size-4 animate-spin" aria-hidden="true" />
          ) : (
            <Check className="mr-2 size-4" aria-hidden="true" />
          )}
          Verify payment and admit member.
        </Button>
      </div>
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

function DetailField({
  children,
  label,
}: {
  children: ReactNode;
  label: string;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-1 break-words text-sm font-medium">
        {children || "—"}
      </dd>
    </div>
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
