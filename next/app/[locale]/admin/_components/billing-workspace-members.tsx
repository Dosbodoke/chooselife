"use client";

import { Search } from "lucide-react";
import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { BillingWorkspaceMemberRow } from "@/lib/billing-workspace";
import {
  formatBillingDate,
  formatBillingDateTime,
  paymentStateLabel,
  planLabel,
} from "@/lib/billing-workspace";

import { ApplicantAvatar } from "../claims/_components/initial-payment-claim-review";

type MemberStateFilter =
  | "all"
  | "overdue"
  | "payment_available"
  | "under_review"
  | "up_to_date";

function stateVariant(state: string) {
  if (state === "overdue") return "destructive" as const;
  if (state === "up_to_date") return "secondary" as const;
  return "outline" as const;
}

export default function BillingWorkspaceMembers({
  members,
}: {
  members: BillingWorkspaceMemberRow[];
}) {
  const [search, setSearch] = useState("");
  const [stateFilter, setStateFilter] = useState<MemberStateFilter>("all");

  const visibleMembers = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return members.filter((member) => {
      if (
        stateFilter !== "all" &&
        member.financial_standing !== stateFilter
      ) {
        return false;
      }

      if (!normalizedSearch) return true;

      return [member.member_name, member.member_handle, member.plan_type]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(normalizedSearch));
    });
  }, [members, search, stateFilter]);

  return (
    <Card className="overflow-hidden rounded-3xl border-0 shadow-[0_20px_70px_-40px_hsl(var(--foreground)/0.45)]">
      <CardHeader className="border-b bg-card/80 pb-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <CardTitle>Members</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              Active legal roster with financial standing derived from the billing ledger.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <label className="relative block min-w-0 sm:w-64">
              <span className="sr-only">Search members</span>
              <Search
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search members"
                className="h-11 rounded-xl pl-9"
              />
            </label>
            <label>
              <span className="sr-only">Filter member financial standing</span>
              <select
                value={stateFilter}
                onChange={(event) =>
                  setStateFilter(event.target.value as MemberStateFilter)
                }
                className="h-11 min-w-44 rounded-xl border border-input bg-background px-3 text-sm shadow-sm outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="all">All standings</option>
                <option value="overdue">Overdue</option>
                <option value="payment_available">Payment available</option>
                <option value="under_review">Under review</option>
                <option value="up_to_date">Up to date</option>
              </select>
            </label>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-4 md:p-6">
        {visibleMembers.length === 0 ? (
          <div className="flex min-h-64 items-center justify-center rounded-2xl border border-dashed px-6 text-center text-sm text-muted-foreground">
            {members.length === 0
              ? "No active members are available for this association."
              : "No members match these filters."}
          </div>
        ) : (
          <div className="grid gap-3 xl:grid-cols-2">
            {visibleMembers.map((member) => (
              <article
                key={member.member_user_id}
                className="rounded-2xl border bg-card p-4 md:p-5"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex min-w-0 items-center gap-3">
                    <ApplicantAvatar
                      name={member.member_name}
                      handle={member.member_handle}
                      picture={member.member_profile_picture}
                      size="sm"
                    />
                    <div className="min-w-0">
                      <h2 className="truncate font-semibold">
                        {member.member_name || "Unnamed member"}
                      </h2>
                      <p className="truncate text-sm text-muted-foreground">
                        {member.member_handle || "No handle"} · {member.member_role}
                      </p>
                    </div>
                  </div>
                  <Badge variant={stateVariant(member.financial_standing)}>
                    {paymentStateLabel(member.financial_standing)}
                  </Badge>
                </div>

                <dl className="mt-5 grid gap-x-4 gap-y-4 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="text-muted-foreground">Plan</dt>
                    <dd className="mt-1 font-medium">{planLabel(member.plan_type)}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Overdue obligations</dt>
                    <dd className="mt-1 font-medium tabular-nums">
                      {member.overdue_count}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Oldest attention</dt>
                    <dd className="mt-1 font-medium">
                      {formatBillingDate(member.oldest_attention_due_on)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Next due</dt>
                    <dd className="mt-1 font-medium">
                      {formatBillingDate(member.next_due_on)}
                    </dd>
                  </div>
                  <div className="sm:col-span-2">
                    <dt className="text-muted-foreground">Last verified contribution</dt>
                    <dd className="mt-1 font-medium">
                      {formatBillingDateTime(member.last_verified_contribution_at)}
                    </dd>
                  </div>
                </dl>
              </article>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
