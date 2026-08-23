"use client";

import { Search } from "lucide-react";
import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { BillingWorkspacePaymentRow } from "@/lib/billing-workspace";
import {
  formatBillingAmount,
  formatBillingDate,
  formatBillingDateTime,
  jsonArray,
  paymentStateLabel,
  planLabel,
  purposeLabel,
} from "@/lib/billing-workspace";

type PaymentStateFilter =
  | "all"
  | "scheduled"
  | "available"
  | "under_review"
  | "overdue"
  | "settled"
  | "void";
type PaymentPurposeFilter = "all" | BillingWorkspacePaymentRow["purpose"];

function stateVariant(state: string) {
  if (state === "overdue") return "destructive" as const;
  if (state === "settled") return "secondary" as const;
  if (state === "under_review") return "default" as const;
  return "outline" as const;
}

function historyEntryKey(
  title: string,
  entry: ReturnType<typeof jsonArray>[number],
) {
  return (
    entry.id ??
    entry.claim_id ??
    [
      title,
      entry.created_at,
      entry.status,
      entry.previous_state,
      entry.next_state,
      entry.reason,
      entry.decision_reason,
    ].join("|")
  );
}

export default function BillingWorkspacePayments({
  payments,
}: {
  payments: BillingWorkspacePaymentRow[];
}) {
  const [search, setSearch] = useState("");
  const [stateFilter, setStateFilter] = useState<PaymentStateFilter>("all");
  const [purposeFilter, setPurposeFilter] =
    useState<PaymentPurposeFilter>("all");

  const visiblePayments = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return payments.filter((payment) => {
      if (
        stateFilter !== "all" &&
        payment.effective_payment_state !== stateFilter
      ) {
        return false;
      }

      if (purposeFilter !== "all" && payment.purpose !== purposeFilter) {
        return false;
      }

      if (!normalizedSearch) return true;

      return [
        payment.member_name,
        payment.member_handle,
        payment.period_key,
        payment.latest_claim_decision_reason,
      ]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(normalizedSearch));
    });
  }, [payments, purposeFilter, search, stateFilter]);

  return (
    <Card className="overflow-hidden rounded-3xl border-0 shadow-[0_20px_70px_-40px_hsl(var(--foreground)/0.45)]">
      <CardHeader className="border-b bg-card/80 pb-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <CardTitle>Payments</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              Private obligation history scoped to this association.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <label className="relative block min-w-0 sm:w-64">
              <span className="sr-only">Search payments</span>
              <Search
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search member or period"
                className="h-11 rounded-xl pl-9"
              />
            </label>
            <label>
              <span className="sr-only">Filter payment state</span>
              <select
                value={stateFilter}
                onChange={(event) =>
                  setStateFilter(event.target.value as PaymentStateFilter)
                }
                className="h-11 min-w-40 rounded-xl border border-input bg-background px-3 text-sm shadow-sm outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="all">All payment states</option>
                <option value="under_review">Under review</option>
                <option value="available">Available</option>
                <option value="overdue">Overdue</option>
                <option value="scheduled">Scheduled</option>
                <option value="settled">Settled</option>
                <option value="void">Void</option>
              </select>
            </label>
            <label>
              <span className="sr-only">Filter payment purpose</span>
              <select
                value={purposeFilter}
                onChange={(event) =>
                  setPurposeFilter(event.target.value as PaymentPurposeFilter)
                }
                className="h-11 min-w-44 rounded-xl border border-input bg-background px-3 text-sm shadow-sm outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="all">All purposes</option>
                <option value="initial_admission">Initial admission</option>
                <option value="recurring">Recurring contribution</option>
              </select>
            </label>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 p-4 md:p-6">
        {visiblePayments.length === 0 ? (
          <div className="flex min-h-64 items-center justify-center rounded-2xl border border-dashed px-6 text-center text-sm text-muted-foreground">
            {payments.length === 0
              ? "No payment obligations are available for this association."
              : "No payment obligations match these filters."}
          </div>
        ) : (
          visiblePayments.map((payment) => {
            const claims = jsonArray(payment.claim_history);
            const audits = jsonArray(payment.audit_history);

            return (
              <article
                key={payment.obligation_id}
                className="rounded-2xl border bg-card p-4 md:p-5"
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge
                        variant={stateVariant(payment.effective_payment_state)}
                      >
                        {paymentStateLabel(payment.effective_payment_state)}
                      </Badge>
                      <Badge variant="outline">
                        {purposeLabel(payment.purpose)}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {payment.period_key}
                      </span>
                    </div>
                    <h2 className="mt-3 truncate text-lg font-semibold">
                      {payment.member_name || "Unnamed member"}
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      {payment.member_handle || "No handle"} ·{" "}
                      {planLabel(payment.plan_type)}
                    </p>
                  </div>
                  <div className="text-left lg:text-right">
                    <p className="text-xl font-semibold tabular-nums">
                      {formatBillingAmount(payment.amount, payment.currency)}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Due {formatBillingDate(payment.due_on)}
                    </p>
                  </div>
                </div>

                <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
                  <div>
                    <dt className="text-muted-foreground">Period</dt>
                    <dd className="mt-1 font-medium">
                      {formatBillingDate(payment.period_start)} —{" "}
                      {formatBillingDate(payment.period_end)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Latest claim</dt>
                    <dd className="mt-1 font-medium">
                      {payment.latest_claim_status
                        ? paymentStateLabel(payment.latest_claim_status)
                        : "No claim"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">
                      Last decision actor
                    </dt>
                    <dd className="mt-1 font-medium">
                      {payment.last_decision_actor_name || "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Last decision</dt>
                    <dd className="mt-1 font-medium">
                      {formatBillingDateTime(payment.last_decision_at)}
                    </dd>
                  </div>
                </dl>

                {payment.latest_claim_decision_reason ? (
                  <p className="mt-4 rounded-xl bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
                    Reason: {payment.latest_claim_decision_reason}
                  </p>
                ) : null}

                <details className="mt-4 rounded-xl border bg-muted/20 px-3 py-2 text-sm">
                  <summary className="cursor-pointer font-medium">
                    View claim and decision history ({claims.length} claim
                    {claims.length === 1 ? "" : "s"}, {audits.length} audit
                    event
                    {audits.length === 1 ? "" : "s"})
                  </summary>
                  <div className="mt-3 grid gap-4 lg:grid-cols-2">
                    <HistoryList title="Claims" entries={claims} />
                    <HistoryList title="Decisions" entries={audits} />
                  </div>
                </details>
              </article>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}

function HistoryList({
  title,
  entries,
}: {
  title: string;
  entries: ReturnType<typeof jsonArray>;
}) {
  return (
    <div>
      <h3 className="font-medium">{title}</h3>
      {entries.length === 0 ? (
        <p className="mt-2 text-muted-foreground">No history yet.</p>
      ) : (
        <ol className="mt-2 space-y-2">
          {entries.map((entry) => (
            <li
              key={historyEntryKey(title, entry)}
              className="rounded-lg border bg-background p-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium">
                  {entry.status ||
                    `${entry.previous_state || ""} → ${entry.next_state || ""}`}
                </span>
                <span className="text-xs text-muted-foreground">
                  {formatBillingDateTime(entry.created_at)}
                </span>
              </div>
              {entry.actor_name ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  Actor: {entry.actor_name}
                </p>
              ) : null}
              {entry.reason || entry.decision_reason ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  {entry.reason || entry.decision_reason}
                </p>
              ) : null}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
