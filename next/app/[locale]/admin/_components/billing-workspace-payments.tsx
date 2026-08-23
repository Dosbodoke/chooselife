"use client";

import { Search } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
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
  const locale = useLocale();
  const t = useTranslations("admin");
  const stateLabel = (state: string) => {
    if (state === "all") return t("states.allPaymentStates");
    if (state === "under_review") return t("states.underReview");
    if (state === "available") return t("states.available");
    if (state === "overdue") return t("states.overdue");
    if (state === "scheduled") return t("states.scheduled");
    if (state === "settled") return t("states.settled");
    if (state === "void") return t("states.void");
    return state;
  };
  const purposeLabel = (purpose: PaymentPurposeFilter) =>
    purpose === "recurring"
      ? t("purposes.recurringContribution")
      : t("purposes.initialAdmission");
  const planLabel = (plan: BillingWorkspacePaymentRow["plan_type"]) =>
    !plan
      ? t("plans.noActivePlan")
      : plan === "annual"
        ? t("plans.annual")
        : t("plans.monthly");
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
            <CardTitle>{t("payments.title")}</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("payments.description")}
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <label className="relative block min-w-0 sm:w-64">
              <span className="sr-only">{t("payments.searchLabel")}</span>
              <Search
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={t("payments.searchPlaceholder")}
                className="h-11 rounded-xl pl-9"
              />
            </label>
            <label>
              <span className="sr-only">{t("payments.stateFilterLabel")}</span>
              <select
                value={stateFilter}
                onChange={(event) =>
                  setStateFilter(event.target.value as PaymentStateFilter)
                }
                className="h-11 min-w-40 rounded-xl border border-input bg-background px-3 text-sm shadow-sm outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="all">{stateLabel("all")}</option>
                <option value="under_review">{stateLabel("under_review")}</option>
                <option value="available">{stateLabel("available")}</option>
                <option value="overdue">{stateLabel("overdue")}</option>
                <option value="scheduled">{stateLabel("scheduled")}</option>
                <option value="settled">{stateLabel("settled")}</option>
                <option value="void">{stateLabel("void")}</option>
              </select>
            </label>
            <label>
              <span className="sr-only">{t("payments.purposeFilterLabel")}</span>
              <select
                value={purposeFilter}
                onChange={(event) =>
                  setPurposeFilter(event.target.value as PaymentPurposeFilter)
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
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 p-4 md:p-6">
        {visiblePayments.length === 0 ? (
          <div className="flex min-h-64 items-center justify-center rounded-2xl border border-dashed px-6 text-center text-sm text-muted-foreground">
            {payments.length === 0
              ? t("payments.emptyNoPayments")
              : t("payments.emptyNoMatch")}
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
                        {stateLabel(payment.effective_payment_state)}
                      </Badge>
                      <Badge variant="outline">
                        {purposeLabel(payment.purpose)}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {payment.period_key}
                      </span>
                    </div>
                    <h2 className="mt-3 truncate text-lg font-semibold">
                      {payment.member_name || t("common.unnamedMember")}
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      {payment.member_handle || t("common.noHandle")} ·{" "}
                      {planLabel(payment.plan_type)}
                    </p>
                  </div>
                  <div className="text-left lg:text-right">
                    <p className="text-xl font-semibold tabular-nums">
                      {formatBillingAmount(payment.amount, payment.currency, locale)}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {t("common.due")} {formatBillingDate(payment.due_on, locale)}
                    </p>
                  </div>
                </div>

                <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
                  <div>
                    <dt className="text-muted-foreground">{t("common.period")}</dt>
                    <dd className="mt-1 font-medium">
                      {formatBillingDate(payment.period_start, locale)} —{" "}
                      {formatBillingDate(payment.period_end, locale)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">
                      {t("payments.latestClaim")}
                    </dt>
                    <dd className="mt-1 font-medium">
                      {payment.latest_claim_status
                        ? stateLabel(payment.latest_claim_status)
                        : t("common.noClaim")}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">
                      {t("common.lastDecisionActor")}
                    </dt>
                    <dd className="mt-1 font-medium">
                      {payment.last_decision_actor_name || "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">
                      {t("common.lastDecision")}
                    </dt>
                    <dd className="mt-1 font-medium">
                      {formatBillingDateTime(payment.last_decision_at, locale)}
                    </dd>
                  </div>
                </dl>

                {payment.latest_claim_decision_reason ? (
                  <p className="mt-4 rounded-xl bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
                    {t("common.reason")}: {payment.latest_claim_decision_reason}
                  </p>
                ) : null}

                <details className="mt-4 rounded-xl border bg-muted/20 px-3 py-2 text-sm">
                  <summary className="cursor-pointer font-medium">
                    {t("payments.historySummary", {
                      claimCount: claims.length,
                      auditCount: audits.length,
                    })}
                  </summary>
                  <div className="mt-3 grid gap-4 lg:grid-cols-2">
                    <HistoryList
                      title={t("payments.historyClaims")}
                      entries={claims}
                    />
                    <HistoryList
                      title={t("payments.historyDecisions")}
                      entries={audits}
                    />
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
  const locale = useLocale();
  const t = useTranslations("admin");
  const stateLabel = (state: string) => {
    if (state === "under_review") return t("states.underReview");
    if (state === "approved") return t("states.approved");
    if (state === "rejected") return t("states.rejected");
    if (state === "scheduled") return t("states.scheduled");
    if (state === "available") return t("states.available");
    if (state === "overdue") return t("states.overdue");
    if (state === "settled") return t("states.settled");
    if (state === "void") return t("states.void");
    return state;
  };

  return (
    <div>
      <h3 className="font-medium">{title}</h3>
      {entries.length === 0 ? (
        <p className="mt-2 text-muted-foreground">{t("common.noHistory")}</p>
      ) : (
        <ol className="mt-2 space-y-2">
          {entries.map((entry) => (
            <li
              key={historyEntryKey(title, entry)}
              className="rounded-lg border bg-background p-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium">
                  {entry.status
                    ? stateLabel(entry.status)
                    : `${stateLabel(entry.previous_state || "")} → ${stateLabel(entry.next_state || "")}`}
                </span>
                <span className="text-xs text-muted-foreground">
                  {formatBillingDateTime(entry.created_at, locale)}
                </span>
              </div>
              {entry.actor_name ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  {t("common.actor")}: {entry.actor_name}
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
