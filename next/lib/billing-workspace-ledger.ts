import type {
  ClaimStatus,
  FinancialStatus,
  MemberPeriod,
  MemberRow,
  PeriodKey,
  PeriodWaiver,
} from "@/components/admin/member-ledger";

import type {
  BillingWorkspacePaymentRow,
  BillingWorkspacePersonRow,
  BillingWorkspaceWaiverRow,
} from "./billing-workspace";

const financialRank: Record<FinancialStatus, number> = {
  overdue: 0,
  rejected: 1,
  under_review: 2,
  awaiting_payment: 3,
  scheduled: 4,
  paid: 5,
  waived: 6,
  no_obligation: 7,
};

/** Show the most urgent open charge, or the latest resolved period. */
export function mostUrgentMemberPeriod(history: readonly MemberPeriod[]) {
  const resolved = (period: MemberPeriod) =>
    period.status === "paid" ||
    period.status === "waived" ||
    period.status === "no_obligation";
  return [...history].sort((left, right) => {
    const leftResolved = resolved(left);
    const rightResolved = resolved(right);
    if (leftResolved && rightResolved) {
      return (right.dueDate ?? "").localeCompare(left.dueDate ?? "");
    }
    return (
      (leftResolved ? 6 : financialRank[left.status]) -
        (rightResolved ? 6 : financialRank[right.status]) ||
      (left.dueDate ?? "").localeCompare(right.dueDate ?? "")
    );
  })[0];
}

function currentPeriodKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}` as PeriodKey;
}

function normalizePeriodKey(payment: BillingWorkspacePaymentRow): PeriodKey {
  const recurringPeriod = payment.period_key?.match(/^\d{4}-\d{2}$/)?.[0];
  if (recurringPeriod) return recurringPeriod as PeriodKey;

  const dueMonth = payment.due_on?.slice(0, 7);
  if (dueMonth?.match(/^\d{4}-\d{2}$/)) return dueMonth as PeriodKey;

  return currentPeriodKey();
}

/**
 * The obligation's own state cannot tell "never paid" apart from "paid, and we
 * refused it": rejecting a claim deliberately returns the obligation to
 * `available`, because the money is still owed. The refusal only survives on the
 * newest claim, so read it from there.
 *
 * This self-clears without any extra bookkeeping. A fresh claim becomes the
 * newest one and flips `effective_payment_state` to `under_review`, so the chip
 * moves on the moment the person tries again -- and not before.
 *
 * `overdue` deliberately outranks a refusal: a missed due date is the more
 * urgent fact, and the rejection is still one click away in the drawer.
 */
function financialStatus(
  value: string,
  latestClaimStatus: ClaimStatus | null,
  waiver: PeriodWaiver | null,
): FinancialStatus {
  switch (value) {
    case "settled":
      return "paid";
    case "under_review":
      return "under_review";
    case "available":
      return latestClaimStatus === "rejected" ? "rejected" : "awaiting_payment";
    case "overdue":
      return "overdue";
    case "scheduled":
      return "scheduled";
    // A void charge is either a refused admission or a waived month. Only the
    // waiver audit tells them apart, and only a waiver is worth naming.
    case "void":
      return waiver ? "waived" : "no_obligation";
    default:
      return "no_obligation";
  }
}

function isPreferredPeriod(
  current: MemberPeriod | undefined,
  next: MemberPeriod,
) {
  if (!current) return true;

  const currentRank = financialRank[current.status];
  const nextRank = financialRank[next.status];
  if (nextRank !== currentRank) return nextRank < currentRank;

  return (next.dueDate ?? "") > (current.dueDate ?? "");
}

function toMemberPeriod(
  payment: BillingWorkspacePaymentRow,
  locale: string,
  waiver: PeriodWaiver | null,
): MemberPeriod {
  const periodKey = normalizePeriodKey(payment);

  return {
    periodKey,
    periodLabel: new Intl.DateTimeFormat(locale, {
      month: "long",
      year: "numeric",
    }).format(new Date(`${periodKey}-01T00:00:00`)),
    obligationId: payment.obligation_id,
    obligationKind: payment.purpose,
    status: financialStatus(
      payment.effective_payment_state,
      payment.latest_claim_status,
      waiver,
    ),
    // A waived month keeps the amount it was billed at, so the history shows
    // what was forgiven. It no longer counts as owed: every total sums only
    // the statuses that still need paying.
    amount:
      payment.effective_payment_state === "void" && !waiver
        ? null
        : payment.amount,
    currency: payment.currency,
    availableDate: payment.available_on,
    dueDate: payment.due_on,
    paidAt: payment.settled_at,
    claimId: payment.latest_claim_id,
    claimStatus: payment.latest_claim_status,
    claimCreatedAt: payment.latest_claim_created_at,
    claimDecidedAt: payment.latest_claim_decided_at,
    claimReason: payment.latest_claim_decision_reason,
    payerType: null,
    payerName: null,
    attentionReason: null,
    waiver,
  };
}

export function buildBillingWorkspaceMemberRows(
  people: BillingWorkspacePersonRow[],
  payments: BillingWorkspacePaymentRow[],
  locale = "en-US",
  waivers: BillingWorkspaceWaiverRow[] = [],
) {
  const waiverByObligation = new Map<string, PeriodWaiver>(
    waivers.map((waiver) => [
      waiver.obligation_id,
      {
        reason: waiver.reason,
        waivedAt: waiver.waived_at,
        waivedByName: waiver.waived_by_name || waiver.waived_by_handle || null,
      },
    ]),
  );
  const paymentsByMember = new Map<string, BillingWorkspacePaymentRow[]>();
  const periodKeys = new Set<PeriodKey>([currentPeriodKey()]);

  for (const payment of payments) {
    const memberPayments = paymentsByMember.get(payment.member_user_id) ?? [];
    memberPayments.push(payment);
    paymentsByMember.set(payment.member_user_id, memberPayments);
    periodKeys.add(normalizePeriodKey(payment));
  }

  const rows = people.map<MemberRow>((person) => {
    const memberPayments = paymentsByMember.get(person.member_user_id) ?? [];
    const periods: Partial<Record<PeriodKey, MemberPeriod>> = {};

    for (const payment of memberPayments) {
      const period = toMemberPeriod(
        payment,
        locale,
        waiverByObligation.get(payment.obligation_id) ?? null,
      );
      if (isPreferredPeriod(periods[period.periodKey], period)) {
        periods[period.periodKey] = period;
      }
    }

    const latestPlan = [...memberPayments]
      .sort((left, right) => (right.due_on ?? "").localeCompare(left.due_on ?? ""))
      .find((payment) => payment.plan_type)?.plan_type;
    const lifecycle =
      person.lifecycle_status === "pending"
        ? "pending"
        : person.lifecycle_status === "inactive"
          ? "inactive"
          : "active";

    return {
      id: person.member_user_id,
      name: person.member_name ?? "",
      handle: person.member_handle ?? "",
      role:
        lifecycle === "active"
          ? person.member_role === "admin"
            ? "admin"
            : "member"
          : lifecycle,
      profilePicture: person.member_profile_picture ?? null,
      lifecycle,
      plan: person.plan_type ?? latestPlan ?? null,
      joinedAt: person.joined_at ?? null,
      lastVerifiedContributionAt: person.last_verified_contribution_at ?? null,
      periods,
      history: Object.values(periods).sort((left, right) =>
        (right?.dueDate ?? "").localeCompare(left?.dueDate ?? ""),
      ) as MemberPeriod[],
    };
  });

  return {
    rows,
    periodOptions: [...periodKeys]
      .sort((left, right) => right.localeCompare(left))
      .map((key) => ({
        key,
        label: new Intl.DateTimeFormat(locale, {
          month: "long",
          year: "numeric",
        }).format(new Date(`${key}-01T00:00:00`)),
      })),
  };
}
