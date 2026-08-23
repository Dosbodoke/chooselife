"use client";

/* eslint-disable @next/next/no-img-element */

import {
  AlertTriangle,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock3,
  FileText,
  Loader2,
  Search,
  ShieldCheck,
  UserRound,
  X,
  XCircle,
} from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useRouter } from "@/i18n/navigation";
import {
  type InitialPaymentClaimDetail,
  type InitialPaymentClaimQueueRow,
} from "@/lib/initial-payment-claims";
import { supabaseBrowser } from "@/utils/supabase/client";

type QueueStatusFilter = "all" | "under_review";
type QueueSort = "oldest" | "newest" | "amount" | "applicant";
type Action = "approve" | "reject" | null;

const supabase = supabaseBrowser();

function formatAmount(amount: number, currency: string) {
  return new Intl.NumberFormat("pt-BR", {
    currency,
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
    style: "currency",
  }).format(amount / 100);
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—";

  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

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

function getRpcErrorMessage(error: { code?: string; message?: string }) {
  if (error.code === "40001") {
    return "Another reviewer may have acted on this claim. The review stays open while we refresh the authoritative state.";
  }

  if (error.code === "42501") {
    return "You are not authorized to inspect or decide this claim.";
  }

  if (error.code === "22023") {
    return error.message || "Check the information and try again.";
  }

  return "The decision could not be completed. Nothing was changed; try again.";
}

function getHistory(value: unknown) {
  return Array.isArray(value)
    ? value.filter(
        (entry): entry is Record<string, unknown> =>
          typeof entry === "object" && entry !== null,
      )
    : [];
}

function statusLabel(status: QueueStatusFilter) {
  return status === "all" ? "All current claims" : "Awaiting review";
}

function QueueStatusBadge({
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

function ApplicantAvatar({
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
        <img
          src={picture}
          alt=""
          className="size-full object-cover"
          loading="lazy"
        />
      ) : (
        getInitials(name, handle)
      )}
    </div>
  );
}

export default function InitialPaymentClaimsQueue({
  initialClaims,
}: {
  initialClaims: InitialPaymentClaimQueueRow[];
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<QueueStatusFilter>("all");
  const [sort, setSort] = useState<QueueSort>("oldest");
  const [selectedClaimId, setSelectedClaimId] = useState<string | null>(null);
  const [selectedDetail, setSelectedDetail] =
    useState<InitialPaymentClaimDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [action, setAction] = useState<Action>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [resolvedClaimIds, setResolvedClaimIds] = useState<Set<string>>(
    () => new Set(),
  );

  const visibleClaims = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    const filteredClaims = initialClaims.filter((claim) => {
      if (resolvedClaimIds.has(claim.claim_id)) return false;
      if (statusFilter !== "all" && claim.claim_status !== statusFilter) {
        return false;
      }

      if (!normalizedSearch) return true;

      return [
        claim.applicant_name,
        claim.applicant_handle,
        claim.payer_name,
        claim.organization_name,
      ]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(normalizedSearch));
    });

    return [...filteredClaims].sort((left, right) => {
      if (sort === "amount") return right.amount - left.amount;
      if (sort === "applicant") {
        return (
          left.applicant_name ||
          left.applicant_handle ||
          ""
        ).localeCompare(right.applicant_name || right.applicant_handle || "");
      }

      const leftDate = new Date(left.claim_created_at).getTime();
      const rightDate = new Date(right.claim_created_at).getTime();
      return sort === "newest" ? rightDate - leftDate : leftDate - rightDate;
    });
  }, [initialClaims, resolvedClaimIds, search, sort, statusFilter]);

  const loadDetail = async (claimId: string, showLoading = true) => {
    if (showLoading) setDetailLoading(true);
    setActionError(null);

    const { data, error } = await supabase.rpc(
      "get_initial_payment_claim_detail",
      { p_claim_id: claimId },
    );

    if (error) {
      setSelectedDetail(null);
      setActionError(getRpcErrorMessage(error));
    } else if (data?.[0]) {
      setSelectedDetail(data[0]);
    } else {
      setSelectedDetail(null);
      setActionError(
        "This claim is no longer available to your reviewer scope. Refresh the queue.",
      );
    }

    if (showLoading) setDetailLoading(false);
  };

  const openClaim = async (claimId: string) => {
    setSelectedClaimId(claimId);
    setSelectedDetail(null);
    setRejectionReason("");
    setActionError(null);
    await loadDetail(claimId);
  };

  const closeClaim = () => {
    if (action) return;
    setSelectedClaimId(null);
    setSelectedDetail(null);
    setActionError(null);
    setRejectionReason("");
  };

  const removeResolvedClaim = (claimId: string) => {
    setResolvedClaimIds((current) => {
      const next = new Set(current);
      next.add(claimId);
      return next;
    });
    setSelectedClaimId(null);
    setSelectedDetail(null);
    setActionError(null);
    setRejectionReason("");
    router.refresh();
  };

  const handleApprove = async () => {
    if (!selectedClaimId) return;

    setAction("approve");
    setActionError(null);

    const { error } = await supabase.rpc("approve_initial_claim", {
      p_claim_id: selectedClaimId,
    });

    if (error) {
      setActionError(getRpcErrorMessage(error));
      if (error.code === "40001") {
        await loadDetail(selectedClaimId, false);
        router.refresh();
      }
      setAction(null);
      return;
    }

    removeResolvedClaim(selectedClaimId);
    setAction(null);
  };

  const handleReject = async () => {
    if (!selectedClaimId) return;

    const normalizedReason = rejectionReason.trim().replace(/\s+/g, " ");
    if (!normalizedReason) {
      setActionError("A rejection reason is required.");
      return;
    }

    setAction("reject");
    setActionError(null);

    const { error } = await supabase.rpc("reject_initial_claim", {
      p_claim_id: selectedClaimId,
      p_reason: normalizedReason,
    });

    if (error) {
      setActionError(getRpcErrorMessage(error));
      if (error.code === "40001") {
        await loadDetail(selectedClaimId, false);
        router.refresh();
      }
      setAction(null);
      return;
    }

    removeResolvedClaim(selectedClaimId);
    setAction(null);
  };

  const reviewSurface = (
    <ReviewContent
      action={action}
      actionError={actionError}
      detail={selectedDetail}
      detailLoading={detailLoading}
      onApprove={handleApprove}
      onClose={closeClaim}
      onReject={handleReject}
      rejectionReason={rejectionReason}
      setRejectionReason={setRejectionReason}
    />
  );

  return (
    <section className="min-h-[calc(100vh-5rem)] bg-muted/20 px-4 py-8 md:px-6 md:py-12">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm font-medium uppercase tracking-[0.18em] text-muted-foreground">
              <ShieldCheck className="size-4" aria-hidden="true" />
              Association administration
            </div>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight">
              Initial payment claims
            </h1>
            <p className="mt-3 max-w-2xl text-muted-foreground">
              Verify a payment and admit one applicant at a time. Every action
              is checked and committed by the database as one decision.
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-2xl border bg-card px-4 py-3 text-sm shadow-sm">
            <span className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-primary">
              <FileText className="size-4" aria-hidden="true" />
            </span>
            <span>
              <span className="block font-semibold tabular-nums">
                {visibleClaims.length}
              </span>
              <span className="text-muted-foreground">visible claims</span>
            </span>
          </div>
        </div>

        <Card className="mt-8 overflow-hidden rounded-3xl border-0 shadow-[0_20px_70px_-40px_hsl(var(--foreground)/0.45)]">
          <CardHeader className="border-b bg-card/80 pb-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <CardTitle>Queue</CardTitle>
                <CardDescription className="mt-1">
                  Current initial claims from the associations you administer.
                </CardDescription>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <label className="relative block min-w-0 sm:w-72">
                  <span className="sr-only">Search claims</span>
                  <Search
                    className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <Input
                    type="search"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search applicant or payer"
                    className="h-11 rounded-xl pl-9"
                  />
                </label>
                <label>
                  <span className="sr-only">Filter payment state</span>
                  <select
                    value={statusFilter}
                    onChange={(event) =>
                      setStatusFilter(event.target.value as QueueStatusFilter)
                    }
                    className="h-11 min-w-44 rounded-xl border border-input bg-background px-3 text-sm shadow-sm outline-none focus:ring-1 focus:ring-ring"
                  >
                    <option value="all">{statusLabel("all")}</option>
                    <option value="under_review">
                      {statusLabel("under_review")}
                    </option>
                  </select>
                </label>
                <label>
                  <span className="sr-only">Sort claims</span>
                  <select
                    value={sort}
                    onChange={(event) =>
                      setSort(event.target.value as QueueSort)
                    }
                    className="h-11 min-w-40 rounded-xl border border-input bg-background px-3 text-sm shadow-sm outline-none focus:ring-1 focus:ring-ring"
                  >
                    <option value="oldest">Oldest first</option>
                    <option value="newest">Newest first</option>
                    <option value="amount">Highest amount</option>
                    <option value="applicant">Applicant name</option>
                  </select>
                </label>
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            {visibleClaims.length === 0 ? (
              <div className="flex min-h-72 flex-col items-center justify-center px-6 py-16 text-center">
                <span className="flex size-14 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="size-7" aria-hidden="true" />
                </span>
                <h2 className="mt-5 text-xl font-semibold">
                  {initialClaims.length === 0
                    ? "The queue is clear"
                    : "No claims match these filters"}
                </h2>
                <p className="mt-2 max-w-md text-sm text-muted-foreground">
                  {initialClaims.length === 0
                    ? "New initial payment claims will appear here when an applicant submits one."
                    : "Try clearing the search or changing the sort and payment-state filters."}
                </p>
              </div>
            ) : (
              <div role="list" aria-label="Initial payment claims">
                {visibleClaims.map((claim) => (
                  <div key={claim.claim_id} role="listitem">
                    <button
                      type="button"
                      onClick={() => void openClaim(claim.claim_id)}
                      className="group grid w-full grid-cols-[auto_1fr_auto] items-center gap-4 px-5 py-4 text-left transition-[background-color,transform] duration-200 hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring active:scale-[0.996] md:grid-cols-[minmax(14rem,1.7fr)_minmax(8rem,0.8fr)_minmax(8rem,0.7fr)_minmax(8rem,0.7fr)_auto] md:px-6"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <ApplicantAvatar
                          name={claim.applicant_name}
                          handle={claim.applicant_handle}
                          picture={claim.applicant_profile_picture}
                          size="sm"
                        />
                        <div className="min-w-0">
                          <p className="truncate font-semibold">
                            {claim.applicant_name || "Unnamed applicant"}
                          </p>
                          <p className="truncate text-sm text-muted-foreground">
                            {claim.applicant_handle || "No handle"}
                          </p>
                        </div>
                      </div>
                      <div className="hidden min-w-0 md:block">
                        <p className="truncate text-sm font-medium">
                          {claim.payer_type === "applicant"
                            ? "Applicant"
                            : claim.payer_name || "Other payer"}
                        </p>
                        <p className="text-xs text-muted-foreground">Payer</p>
                      </div>
                      <div className="hidden md:block">
                        <p className="font-semibold">
                          {claim.plan_type === "annual" ? "Annual" : "Monthly"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {claim.attempt_count} attempt
                          {claim.attempt_count === 1 ? "" : "s"}
                        </p>
                      </div>
                      <div className="hidden md:block">
                        <p className="font-semibold tabular-nums">
                          {formatAmount(claim.amount, claim.currency)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatDate(claim.claim_created_at)}
                        </p>
                      </div>
                      <div className="flex items-center justify-end gap-3">
                        <QueueStatusBadge status={claim.claim_status} />
                        <ChevronRight
                          className="size-5 text-muted-foreground transition-transform duration-200 group-hover:translate-x-0.5"
                          aria-hidden="true"
                        />
                      </div>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="hidden md:block">
        <Dialog
          open={selectedClaimId !== null}
          onOpenChange={(open) => {
            if (!open) closeClaim();
          }}
        >
          <DialogContent className="max-h-[90vh] max-w-3xl overflow-hidden rounded-3xl p-0">
            <DialogHeader className="sr-only">
              <DialogTitle>Review initial payment claim</DialogTitle>
              <DialogDescription>
                Inspect the submitted application revision and decide this
                payment claim.
              </DialogDescription>
            </DialogHeader>
            {reviewSurface}
          </DialogContent>
        </Dialog>
      </div>

      <div className="md:hidden">
        <Drawer
          open={selectedClaimId !== null}
          onOpenChange={(open) => {
            if (!open) closeClaim();
          }}
        >
          <DrawerContent className="max-h-[96vh] overflow-hidden rounded-t-3xl p-0">
            <DrawerHeader className="sr-only">
              <DrawerTitle>Review initial payment claim</DrawerTitle>
              <DrawerDescription>
                Inspect the submitted application revision and decide this
                payment claim.
              </DrawerDescription>
            </DrawerHeader>
            {reviewSurface}
          </DrawerContent>
        </Drawer>
      </div>
    </section>
  );
}

function ReviewContent({
  action,
  actionError,
  detail,
  detailLoading,
  onApprove,
  onClose,
  onReject,
  rejectionReason,
  setRejectionReason,
}: {
  action: Action;
  actionError: string | null;
  detail: InitialPaymentClaimDetail | null;
  detailLoading: boolean;
  onApprove: () => Promise<void>;
  onClose: () => void;
  onReject: () => Promise<void>;
  rejectionReason: string;
  setRejectionReason: (value: string) => void;
}) {
  const claimHistory = getHistory(detail?.claim_history);
  const auditHistory = getHistory(detail?.audit_history);
  const isActionable = detail?.claim_status === "under_review";

  return (
    <div className="flex max-h-[90vh] flex-col bg-background">
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
              <Badge variant="secondary">
                Revision {detail.revision_number}
              </Badge>
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

            <section aria-labelledby="application-title">
              <SectionHeading
                id="application-title"
                icon={<FileText className="size-4" aria-hidden="true" />}
                title="Submitted application revision"
              />
              <div className="mt-3 grid gap-x-6 gap-y-4 rounded-2xl border bg-muted/20 p-4 sm:grid-cols-2">
                <DetailField label="Full name">{detail.full_name}</DetailField>
                <DetailField label="Handle">
                  {detail.applicant_handle}
                </DetailField>
                <DetailField label="Birth date">
                  {detail.birth_date}
                </DetailField>
                <DetailField label="Nationality">
                  {detail.nationality}
                </DetailField>
                <DetailField label="Marital status">
                  {detail.marital_status}
                </DetailField>
                <DetailField label="Profession">
                  {detail.profession}
                </DetailField>
                <DetailField label="Birthplace">
                  {detail.birthplace}
                </DetailField>
                <DetailField label="Email">{detail.email}</DetailField>
                <DetailField label="Phone">{detail.phone}</DetailField>
                <DetailField label="CPF">{detail.cpf}</DetailField>
                <DetailField label="ID document">
                  {detail.id_document_number}
                </DetailField>
                <DetailField label="Issuing authority">
                  {detail.id_document_issuer}
                </DetailField>
                <DetailField label="Postal code">
                  {detail.postal_code}
                </DetailField>
                <DetailField label="Address">{detail.address_line}</DetailField>
                <DetailField label="City / state">
                  {[detail.city, detail.state].filter(Boolean).join(" / ")}
                </DetailField>
                <DetailField label="Blood type">
                  {detail.blood_type}
                </DetailField>
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

            {claimHistory.length > 0 || auditHistory.length > 0 ? (
              <section aria-labelledby="history-title">
                <SectionHeading
                  id="history-title"
                  icon={<CalendarDays className="size-4" aria-hidden="true" />}
                  title="Immutable history"
                />
                <div className="mt-3 grid gap-3 rounded-2xl border bg-muted/20 p-4 lg:grid-cols-2">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">
                      Claim states
                    </p>
                    <div className="mt-2 space-y-2">
                      {claimHistory.map((history) => (
                        <div
                          key={String(history.claim_id)}
                          className="flex flex-wrap items-center justify-between gap-2 text-sm"
                        >
                          <span className="font-medium">
                            {String(history.status)}
                          </span>
                          <span className="text-muted-foreground">
                            {formatDate(String(history.created_at))}
                            {history.decision_reason
                              ? ` · ${String(history.decision_reason)}`
                              : ""}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">
                      Audit events
                    </p>
                    <div className="mt-2 space-y-2">
                      {auditHistory.map((history) => (
                        <div
                          key={String(history.id)}
                          className="flex flex-wrap items-center justify-between gap-2 text-sm"
                        >
                          <span className="font-medium">
                            {String(history.previous_state)} →{" "}
                            {String(history.next_state)}
                          </span>
                          <span className="text-muted-foreground">
                            {formatDate(String(history.created_at))}
                            {history.reason
                              ? ` · ${String(history.reason)}`
                              : ""}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </section>
            ) : null}
          </div>
        )}
      </div>

      {detail && isActionable ? (
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
            onChange={(event) => setRejectionReason(event.target.value)}
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
                <Loader2
                  className="mr-2 size-4 animate-spin"
                  aria-hidden="true"
                />
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
                <Loader2
                  className="mr-2 size-4 animate-spin"
                  aria-hidden="true"
                />
              ) : (
                <Check className="mr-2 size-4" aria-hidden="true" />
              )}
              Verify payment and admit member.
            </Button>
          </div>
        </div>
      ) : detail ? (
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
