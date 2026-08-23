import type { Json } from '~/utils/database.types';

import { supabase } from './supabase';

export type LedgerFinancialStanding =
  'up_to_date' | 'payment_available' | 'under_review' | 'overdue';

export type LedgerObligationStatus =
  'scheduled' | 'available' | 'under_review' | 'overdue' | 'settled' | 'void';

export type LedgerAction = { type: 'open_obligation' } | { type: 'open_claim' };

export type LedgerClaim = {
  claim_id: string;
  status: 'under_review' | 'approved' | 'rejected';
  payer: 'applicant' | 'other';
  payer_name: string | null;
  created_at: string;
  decided_at: string | null;
  decision_reason: string | null;
};

export type LedgerObligation = {
  obligation_id: string | null;
  purpose: 'initial_admission' | 'recurring';
  status: LedgerObligationStatus;
  period_key: string;
  period_start: string;
  period_end: string;
  available_on: string;
  due_on: string;
  amount: number;
  currency: string;
  action: LedgerAction | null;
  claims?: LedgerClaim[];
  settled_at?: string | null;
};

export type MembershipBillingLedger = {
  organization_id: string;
  organization_slug: string;
  organization_name: string;
  legal_membership_state: 'applicant' | 'active';
  application_status: 'draft' | 'submitted' | null;
  application_correction_reason: string | null;
  financial_standing: LedgerFinancialStanding;
  evaluated_at: string;
  plan_type: 'monthly' | 'annual' | null;
  attention_obligation: LedgerObligation | null;
  next_contribution: LedgerObligation | null;
  history: LedgerObligation[];
  history_limit: number;
  history_has_more: boolean;
  history_next_cursor: string | null;
};

function asJsonRecord(value: Json): Record<string, Json | undefined> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('The server returned an invalid Ledger response.');
  }

  return value as Record<string, Json | undefined>;
}

export async function fetchMembershipBillingLedger(
  organizationId: string,
  historyCursor?: string | null,
): Promise<MembershipBillingLedger> {
  const { data, error } = await supabase.rpc('get_membership_billing_ledger', {
    p_organization_id: organizationId,
    p_history_cursor: historyCursor ?? undefined,
  });

  if (error) throw error;

  return asJsonRecord(data as Json) as unknown as MembershipBillingLedger;
}
