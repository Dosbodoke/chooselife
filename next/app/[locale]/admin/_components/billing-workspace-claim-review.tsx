"use client";

import {
  AlertTriangle,
  CalendarDays,
  Check,
  CheckCircle2,
  Clock3,
  Loader2,
  X,
  XCircle,
} from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { BillingWorkspaceClaimDetail } from "@/lib/billing-workspace";
import {
  formatBillingAmount,
  formatBillingDate,
  formatBillingDateTime,
  jsonArray,
  planLabel,
  purposeLabel,
} from "@/lib/billing-workspace";

import type { ReviewAction } from "../claims/_components/initial-payment-claim-review";

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
  const claimHistory = jsonArray(detail?.claim_history);
  const auditHistory = jsonArray(detail?.audit_history);

  return (
    <div className="flex max-h-[96vh] flex-col overflow-hidden">
      <header className="flex items-center justify-between gap-4 border-b px-5 py-5 md:px-7">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
            Recurring claim review
          </p>
          <h2 className="mt-1 truncate text-xl font-semibold">
            {detail?.member_name || "Loading member"}
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
          aria-label="Close review"
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
              aria-label="Loading claim details"
            />
          </div>
        ) : !detail ? (
          <div className="flex min-h-72 items-center justify-center">
            <Alert variant="destructive" className="max-w-lg">
              <AlertTriangle className="size-4" aria-hidden="true" />
              <AlertTitle>Review unavailable</AlertTitle>
              <AlertDescription>
                {actionError || "Refresh the workspace and try again."}
              </AlertDescription>
            </Alert>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">
                <Clock3 className="mr-1.5 size-3.5" aria-hidden="true" />
                {detail.claim_status === "under_review"
                  ? "Awaiting review"
                  : detail.claim_status}
              </Badge>
              <Badge variant="secondary">{purposeLabel(detail.purpose)}</Badge>
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
                label="Contribution"
                value={formatBillingAmount(detail.amount, detail.currency)}
              />
              <SummaryCard label="Plan" value={planLabel(detail.plan_type)} />
              <SummaryCard label="Submitted" value={formatBillingDateTime(detail.claim_created_at)} />
            </div>

            <section aria-labelledby="recurring-obligation-title">
              <SectionHeading
                id="recurring-obligation-title"
                icon={<CalendarDays className="size-4" aria-hidden="true" />}
                title="Recurring obligation"
              />
              <div className="mt-3 grid gap-x-6 gap-y-4 rounded-2xl border bg-muted/20 p-4 sm:grid-cols-2">
                <DetailField label="Period">{detail.period_key}</DetailField>
                <DetailField label="Payer">
                  {detail.payer_type === "applicant"
                    ? "Member"
                    : detail.payer_name || "Other payer"}
                </DetailField>
                <DetailField label="Period start">
                  {formatBillingDate(detail.period_start)}
                </DetailField>
                <DetailField label="Period end">
                  {formatBillingDate(detail.period_end)}
                </DetailField>
                <DetailField label="Available on">
                  {formatBillingDate(detail.available_on)}
                </DetailField>
                <DetailField label="Due on">
                  {formatBillingDate(detail.due_on)}
                </DetailField>
                <DetailField label="Claim attempts">
                  {detail.attempt_count}
                </DetailField>
                <DetailField label="Claim submitted">
                  {formatBillingDateTime(detail.claim_created_at)}
                </DetailField>
              </div>
            </section>

            <section aria-labelledby="recurring-safety-title" className="rounded-2xl border border-primary/20 bg-primary/5 p-4">
              <h3 id="recurring-safety-title" className="font-semibold">
                Decision scope
              </h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Approval settles this one obligation and records the reviewer.
                It never changes legal membership, role, schedule anchors, due
                dates, plan assignments, or any other obligation.
              </p>
            </section>

            {claimHistory.length > 0 || auditHistory.length > 0 ? (
              <section aria-labelledby="recurring-history-title">
                <SectionHeading
                  id="recurring-history-title"
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
                          {formatBillingDateTime(history.created_at)}
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
                          {history.actor_name ? `${String(history.actor_name)} · ` : ""}
                          {formatBillingDateTime(history.created_at)}
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

      {detail ? (
        detail.claim_status !== "under_review" ? (
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
                This claim is {detail.claim_status}. Its obligation and full
                chronology remain authoritative.
              </p>
            </div>
          </div>
        ) : (
          <div className="border-t bg-card px-5 py-4 md:px-7">
            <label htmlFor="recurring-rejection-reason" className="text-sm font-medium">
              Rejection reason
              <span className="ml-1 text-destructive" aria-hidden="true">
                *
              </span>
            </label>
            <Textarea
              id="recurring-rejection-reason"
              value={rejectionReason}
              onChange={(event) => onRejectionReasonChange(event.target.value)}
              maxLength={500}
              placeholder="Explain what needs to be corrected."
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
                Reject recurring claim
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
                Approve recurring contribution
              </Button>
            </div>
          </div>
        )
      ) : null}
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
