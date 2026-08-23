"use client";

import { CheckCircle2, ChevronRight, Search, ShieldCheck } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type {
  BillingWorkspaceQueueRow,
  BillingWorkspaceView,
} from "@/lib/billing-workspace";
import {
  formatBillingAmount,
  formatBillingDate,
  formatBillingDateTime,
} from "@/lib/billing-workspace";

import { ApplicantAvatar } from "../claims/_components/initial-payment-claim-review";

type QueueStatusFilter = "all" | "under_review" | "approved" | "rejected";
type QueuePurposeFilter = "all" | BillingWorkspaceQueueRow["purpose"];
type QueueSort = "oldest" | "newest" | "amount" | "member";

function statusVariant(status: BillingWorkspaceQueueRow["claim_status"]) {
  if (status === "under_review") return "default" as const;
  if (status === "approved") return "secondary" as const;
  return "outline" as const;
}

function ClaimStatusBadge({
  status,
}: {
  status: BillingWorkspaceQueueRow["claim_status"];
}) {
  const t = useTranslations("admin");
  const label =
    status === "under_review"
      ? t("states.awaitingReview")
      : status === "approved"
        ? t("states.approved")
        : t("states.rejected");

  return <Badge variant={statusVariant(status)}>{label}</Badge>;
}

export default function BillingWorkspaceQueue({
  claims,
  onOpenClaim,
}: {
  claims: BillingWorkspaceQueueRow[];
  onOpenClaim: (claim: BillingWorkspaceQueueRow) => void;
}) {
  const locale = useLocale();
  const t = useTranslations("admin");
  const statusLabel = (status: QueueStatusFilter) => {
    if (status === "all") return t("states.allClaims");
    if (status === "under_review") return t("states.awaitingReview");
    return status === "approved" ? t("states.approved") : t("states.rejected");
  };
  const purposeLabel = (purpose: QueuePurposeFilter) =>
    purpose === "recurring"
      ? t("purposes.recurringContribution")
      : t("purposes.initialAdmission");
  const planLabel = (plan: BillingWorkspaceQueueRow["plan_type"]) =>
    !plan
      ? t("plans.noActivePlan")
      : plan === "annual"
        ? t("plans.annual")
        : t("plans.monthly");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<QueueStatusFilter>(
    "under_review",
  );
  const [purposeFilter, setPurposeFilter] = useState<QueuePurposeFilter>(
    "all",
  );
  const [sort, setSort] = useState<QueueSort>("oldest");

  const visibleClaims = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    const filteredClaims = claims.filter((claim) => {
      if (
        statusFilter !== "all" &&
        claim.claim_status !== statusFilter
      ) {
        return false;
      }

      if (purposeFilter !== "all" && claim.purpose !== purposeFilter) {
        return false;
      }

      if (!normalizedSearch) return true;

      return [
        claim.member_name,
        claim.member_handle,
        claim.payer_name,
        claim.period_key,
      ]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(normalizedSearch));
    });

    return [...filteredClaims].sort((left, right) => {
      if (sort === "amount") return right.amount - left.amount;
      if (sort === "member") {
        return (left.member_name || left.member_handle || "").localeCompare(
          right.member_name || right.member_handle || "",
        );
      }

      const leftDate = new Date(left.claim_created_at).getTime();
      const rightDate = new Date(right.claim_created_at).getTime();
      return sort === "newest" ? rightDate - leftDate : leftDate - rightDate;
    });
  }, [claims, purposeFilter, search, sort, statusFilter]);

  return (
    <Card className="overflow-hidden rounded-3xl border-0 shadow-[0_20px_70px_-40px_hsl(var(--foreground)/0.45)]">
      <CardHeader className="border-b bg-card/80 pb-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <CardTitle>{t("queue.title")}</CardTitle>
            <CardDescription className="mt-1">
              {t("queue.description")}
            </CardDescription>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <label className="relative block min-w-0 sm:w-64">
              <span className="sr-only">{t("queue.searchLabel")}</span>
              <Search
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={t("queue.searchPlaceholder")}
                className="h-11 rounded-xl pl-9"
              />
            </label>
            <label>
              <span className="sr-only">{t("queue.stateFilterLabel")}</span>
              <select
                value={statusFilter}
                onChange={(event) =>
                  setStatusFilter(event.target.value as QueueStatusFilter)
                }
                className="h-11 min-w-40 rounded-xl border border-input bg-background px-3 text-sm shadow-sm outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="under_review">{statusLabel("under_review")}</option>
                <option value="all">{statusLabel("all")}</option>
                <option value="approved">{statusLabel("approved")}</option>
                <option value="rejected">{statusLabel("rejected")}</option>
              </select>
            </label>
            <label>
              <span className="sr-only">{t("queue.purposeFilterLabel")}</span>
              <select
                value={purposeFilter}
                onChange={(event) =>
                  setPurposeFilter(event.target.value as QueuePurposeFilter)
                }
                className="h-11 min-w-44 rounded-xl border border-input bg-background px-3 text-sm shadow-sm outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="all">{t("purposes.all")}</option>
                <option value="initial_admission">
                  {t("purposes.initialAdmission")}
                </option>
                <option value="recurring">
                  {t("purposes.recurringContribution")}
                </option>
              </select>
            </label>
            <label>
              <span className="sr-only">{t("queue.sortLabel")}</span>
              <select
                value={sort}
                onChange={(event) => setSort(event.target.value as QueueSort)}
                className="h-11 min-w-36 rounded-xl border border-input bg-background px-3 text-sm shadow-sm outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="oldest">{t("queue.sortOldest")}</option>
                <option value="newest">{t("queue.sortNewest")}</option>
                <option value="amount">{t("queue.sortAmount")}</option>
                <option value="member">{t("queue.sortMember")}</option>
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
              {claims.length === 0
                ? t("queue.clearTitle")
                : t("queue.noMatchTitle")}
            </h2>
            <p className="mt-2 max-w-md text-sm text-muted-foreground">
              {claims.length === 0
                ? t("queue.clearDescription")
                : t("queue.noMatchDescription")}
            </p>
          </div>
        ) : (
          <ul aria-label={t("queue.ariaLabel")} className="list-none p-0">
            {visibleClaims.map((claim) => (
              <li key={claim.claim_id}>
                <button
                  type="button"
                  onClick={() => onOpenClaim(claim)}
                  className="group grid w-full grid-cols-[auto_1fr_auto] items-center gap-4 px-5 py-4 text-left transition-[background-color,transform] duration-200 hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring active:scale-[0.996] md:grid-cols-[minmax(14rem,1.7fr)_minmax(11rem,1fr)_minmax(8rem,0.8fr)_minmax(8rem,0.7fr)_auto] md:px-6"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <ApplicantAvatar
                      name={claim.member_name}
                      handle={claim.member_handle}
                      picture={claim.member_profile_picture}
                      size="sm"
                    />
                    <div className="min-w-0">
                      <p className="truncate font-semibold">
                        {claim.member_name || t("common.unnamedMember")}
                      </p>
                      <p className="truncate text-sm text-muted-foreground">
                        {claim.member_handle || t("common.noHandle")}
                      </p>
                    </div>
                  </div>
                  <div className="hidden min-w-0 md:block">
                    <p className="truncate text-sm font-medium">
                      {purposeLabel(claim.purpose)}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {claim.period_key || planLabel(claim.plan_type)}
                    </p>
                  </div>
                  <div className="hidden md:block">
                    <p className="font-semibold tabular-nums">
                      {formatBillingAmount(claim.amount, claim.currency, locale)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatBillingDate(claim.due_on, locale)}{" "}
                      {t("queue.dueLabel")}
                    </p>
                  </div>
                  <div className="hidden md:block">
                    <p className="text-sm font-medium">
                      {claim.payer_type === "applicant"
                        ? t("common.member")
                        : claim.payer_name || t("common.otherPayer")}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatBillingDateTime(claim.claim_created_at, locale)}
                    </p>
                  </div>
                  <div className="flex items-center justify-end gap-3">
                    <ClaimStatusBadge status={claim.claim_status} />
                    <ChevronRight
                      className="size-5 text-muted-foreground transition-transform duration-200 group-hover:translate-x-0.5"
                      aria-hidden="true"
                    />
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

export function WorkspaceHeading({
  view,
  organizationName,
}: {
  view: BillingWorkspaceView;
  organizationName: string;
}) {
  const t = useTranslations("admin");
  const copy =
    view === "queue"
      ? {
          title: t("heading.queueTitle"),
          description: t("heading.queueDescription"),
        }
      : view === "payments"
        ? {
            title: t("heading.paymentsTitle"),
            description: t("heading.paymentsDescription"),
          }
        : {
            title: t("heading.membersTitle"),
            description: t("heading.membersDescription"),
          };

  return (
    <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
      <div>
        <div className="flex items-center gap-2 text-sm font-medium uppercase tracking-[0.18em] text-muted-foreground">
          <ShieldCheck className="size-4" aria-hidden="true" />
          {organizationName}
        </div>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight">{copy.title}</h1>
        <p className="mt-3 max-w-2xl text-muted-foreground">{copy.description}</p>
      </div>
    </div>
  );
}
