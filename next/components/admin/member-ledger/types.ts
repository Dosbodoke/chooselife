import type { Table } from "@tanstack/react-table";

export type LifecycleStatus = "active" | "pending" | "inactive";

export type FinancialStatus =
  | "paid"
  | "under_review"
  | "rejected"
  | "awaiting_payment"
  | "overdue"
  | "scheduled"
  | "no_obligation";

export type ClaimStatus = "under_review" | "approved" | "rejected";

export type ObligationKind = "initial_admission" | "recurring";

export type PeriodKey = `${number}-${number}`;

/** `all` collapses every period into the member's most urgent open charge. */
export type PeriodFilter = PeriodKey | "all";

export type MemberPeriod = {
  periodKey: PeriodKey;
  periodLabel: string;
  obligationId: string | null;
  obligationKind: ObligationKind | null;
  status: FinancialStatus;
  amount: number | null;
  currency: string;
  availableDate: string | null;
  dueDate: string | null;
  paidAt: string | null;
  claimId: string | null;
  claimStatus: ClaimStatus | null;
  claimCreatedAt: string | null;
  claimDecidedAt: string | null;
  claimReason: string | null;
  payerType: string | null;
  payerName: string | null;
  attentionReason: string | null;
};

export type MemberRow = {
  id: string;
  name: string;
  handle: string;
  role: "admin" | "member" | "pending" | "inactive";
  profilePicture: string | null;
  lifecycle: LifecycleStatus;
  plan: "monthly" | "annual" | null;
  joinedAt: string | null;
  lastVerifiedContributionAt: string | null;
  periods: Partial<Record<PeriodKey, MemberPeriod>>;
  history: MemberPeriod[];
};

export type MemberTableRow = MemberRow & {
  selectedPeriod: MemberPeriod;
};

export type LifecycleFilter = LifecycleStatus | "all";
export type FinancialFilter = FinancialStatus | "not_paid" | "all";

export type MemberTableFilters = {
  search: string;
  lifecycle: LifecycleFilter;
  financial: FinancialFilter;
  periodKey: PeriodFilter;
};

export type MemberTableCounts = {
  total: number;
  attention: number;
  paid: number;
  notPaid: number;
  active: number;
  pending: number;
  inactive: number;
};

export type MemberTableController = {
  table: Table<MemberTableRow>;
  filters: MemberTableFilters;
  counts: MemberTableCounts;
  periodOptions: ReadonlyArray<{ key: PeriodKey; label: string }>;
  lifecycleOptions: ReadonlyArray<{
    value: LifecycleFilter;
    label: string;
  }>;
  financialOptions: ReadonlyArray<{
    value: FinancialFilter;
    label: string;
  }>;
  selectedRowId: string | null;
  selectedMember: MemberTableRow | null;
  setSearch: (value: string) => void;
  setLifecycleFilter: (value: LifecycleFilter) => void;
  setFinancialFilter: (value: FinancialFilter) => void;
  setPeriodKey: (value: PeriodFilter) => void;
  setSelectedRowId: (value: string | null) => void;
  resetFilters: () => void;
};
