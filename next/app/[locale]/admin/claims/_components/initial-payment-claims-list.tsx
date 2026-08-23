import { CheckCircle2, ChevronRight, FileText, Search } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { InitialPaymentClaimQueueRow } from "@/lib/initial-payment-claims";

import { formatAmount, formatDate } from "./initial-payment-claim-formatters";
import {
  ApplicantAvatar,
  QueueStatusBadge,
} from "./initial-payment-claim-review";

export type QueueStatusFilter = "all" | "under_review";
export type QueueSort = "oldest" | "newest" | "amount" | "applicant";

function statusLabel(status: QueueStatusFilter) {
  return status === "all" ? "All current claims" : "Awaiting review";
}

export function InitialPaymentClaimsList({
  claims,
  initialClaimsCount,
  onOpenClaim,
  onSearchChange,
  onSortChange,
  onStatusFilterChange,
  search,
  sort,
  statusFilter,
}: {
  claims: InitialPaymentClaimQueueRow[];
  initialClaimsCount: number;
  onOpenClaim: (claimId: string) => void;
  onSearchChange: (value: string) => void;
  onSortChange: (value: QueueSort) => void;
  onStatusFilterChange: (value: QueueStatusFilter) => void;
  search: string;
  sort: QueueSort;
  statusFilter: QueueStatusFilter;
}) {
  return (
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
                onChange={(event) => onSearchChange(event.target.value)}
                placeholder="Search applicant or payer"
                className="h-11 rounded-xl pl-9"
              />
            </label>
            <label>
              <span className="sr-only">Filter payment state</span>
              <select
                value={statusFilter}
                onChange={(event) =>
                  onStatusFilterChange(event.target.value as QueueStatusFilter)
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
                  onSortChange(event.target.value as QueueSort)
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
        {claims.length === 0 ? (
          <div className="flex min-h-72 flex-col items-center justify-center px-6 py-16 text-center">
            <span className="flex size-14 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="size-7" aria-hidden="true" />
            </span>
            <h2 className="mt-5 text-xl font-semibold">
              {initialClaimsCount === 0
                ? "The queue is clear"
                : "No claims match these filters"}
            </h2>
            <p className="mt-2 max-w-md text-sm text-muted-foreground">
              {initialClaimsCount === 0
                ? "New initial payment claims will appear here when an applicant submits one."
                : "Try clearing the search or changing the sort and payment-state filters."}
            </p>
          </div>
        ) : (
          <ul aria-label="Initial payment claims" className="list-none p-0">
            {claims.map((claim) => (
              <li key={claim.claim_id}>
                <button
                  type="button"
                  onClick={() => onOpenClaim(claim.claim_id)}
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
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
