"use client";

import { CheckCircle2, ChevronRight, Search, ShieldCheck } from "lucide-react";
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
  planLabel,
  purposeLabel,
} from "@/lib/billing-workspace";

import { ApplicantAvatar } from "../claims/_components/initial-payment-claim-review";

type QueueStatusFilter = "all" | "under_review" | "approved" | "rejected";
type QueuePurposeFilter = "all" | BillingWorkspaceQueueRow["purpose"];
type QueueSort = "oldest" | "newest" | "amount" | "member";

function statusLabel(status: QueueStatusFilter) {
  if (status === "all") return "All claim states";
  if (status === "under_review") return "Awaiting review";
  return status.charAt(0).toUpperCase() + status.slice(1);
}

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
  return <Badge variant={statusVariant(status)}>{statusLabel(status)}</Badge>;
}

export default function BillingWorkspaceQueue({
  claims,
  onOpenClaim,
}: {
  claims: BillingWorkspaceQueueRow[];
  onOpenClaim: (claim: BillingWorkspaceQueueRow) => void;
}) {
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
            <CardTitle>Review queue</CardTitle>
            <CardDescription className="mt-1">
              Initial and recurring claims from this association. Terminal
              history stays available in the filter; only under-review claims
              expose a decision action.
            </CardDescription>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <label className="relative block min-w-0 sm:w-64">
              <span className="sr-only">Search claims</span>
              <Search
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search member or payer"
                className="h-11 rounded-xl pl-9"
              />
            </label>
            <label>
              <span className="sr-only">Filter claim state</span>
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
              <span className="sr-only">Filter claim purpose</span>
              <select
                value={purposeFilter}
                onChange={(event) =>
                  setPurposeFilter(event.target.value as QueuePurposeFilter)
                }
                className="h-11 min-w-44 rounded-xl border border-input bg-background px-3 text-sm shadow-sm outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="all">All purposes</option>
                <option value="initial_admission">Initial admission</option>
                <option value="recurring">Recurring contribution</option>
              </select>
            </label>
            <label>
              <span className="sr-only">Sort claims</span>
              <select
                value={sort}
                onChange={(event) => setSort(event.target.value as QueueSort)}
                className="h-11 min-w-36 rounded-xl border border-input bg-background px-3 text-sm shadow-sm outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="oldest">Oldest first</option>
                <option value="newest">Newest first</option>
                <option value="amount">Highest amount</option>
                <option value="member">Member name</option>
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
              {claims.length === 0 ? "The queue is clear" : "No claims match these filters"}
            </h2>
            <p className="mt-2 max-w-md text-sm text-muted-foreground">
              {claims.length === 0
                ? "New member claims will appear here when an association member submits one."
                : "Try clearing the search or changing the claim state and purpose filters."}
            </p>
          </div>
        ) : (
          <ul aria-label="Billing claim queue" className="list-none p-0">
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
                        {claim.member_name || "Unnamed member"}
                      </p>
                      <p className="truncate text-sm text-muted-foreground">
                        {claim.member_handle || "No handle"}
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
                      {formatBillingAmount(claim.amount, claim.currency)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatBillingDate(claim.due_on)} due
                    </p>
                  </div>
                  <div className="hidden md:block">
                    <p className="text-sm font-medium">
                      {claim.payer_type === "applicant"
                        ? "Member"
                        : claim.payer_name || "Other payer"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatBillingDateTime(claim.claim_created_at)}
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
  const copy = {
    queue: {
      title: "Review payments one at a time",
      description:
        "Keep each payment decision tied to one immutable obligation and its complete claim history.",
    },
    payments: {
      title: "Payment history",
      description:
        "See the obligation, period, claim, decision, actor, and audit chronology for this association.",
    },
    members: {
      title: "Member financial standing",
      description:
        "Legal membership stays active while financial standing is derived from each obligation.",
    },
  }[view];

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
