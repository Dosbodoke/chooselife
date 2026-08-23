import type {
  FinancialStatus,
  MemberPeriod,
  MemberRow,
  PeriodKey,
} from "@/components/admin/member-ledger";

import type {
  BillingWorkspacePaymentRow,
  BillingWorkspacePersonRow,
} from "./billing-workspace";

const financialRank: Record<FinancialStatus, number> = {
  overdue: 0,
  under_review: 1,
  awaiting_payment: 2,
  scheduled: 3,
  paid: 4,
  no_obligation: 5,
};

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

function financialStatus(value: string): FinancialStatus {
  switch (value) {
    case "settled":
      return "paid";
    case "under_review":
      return "under_review";
    case "available":
      return "awaiting_payment";
    case "overdue":
      return "overdue";
    case "scheduled":
      return "scheduled";
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
    status: financialStatus(payment.effective_payment_state),
    amount:
      payment.effective_payment_state === "void" ? null : payment.amount,
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
  };
}

export function buildBillingWorkspaceMemberRows(
  people: BillingWorkspacePersonRow[],
  payments: BillingWorkspacePaymentRow[],
  locale = "en-US",
) {
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
      const period = toMemberPeriod(payment, locale);
      if (isPreferredPeriod(periods[period.periodKey], period)) {
        periods[period.periodKey] = period;
      }
    }

    const latestPlan = [...memberPayments]
      .sort((left, right) => (right.due_on ?? "").localeCompare(left.due_on ?? ""))
      .find((payment) => payment.plan_type)?.plan_type;
    const lifecycle =
      person.lifecycle_status === "applicant"
        ? "applicant"
        : person.lifecycle_status === "draft"
          ? "draft"
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
