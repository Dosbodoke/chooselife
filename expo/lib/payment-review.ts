import { supabase } from '~/lib/supabase';

export type PaymentUnderReview = {
  amount: number;
  id: string;
  userMarkedPaidAt: string;
};

export async function fetchPaymentUnderReview(
  organizationSlug: string,
  userId: string,
): Promise<PaymentUnderReview | null> {
  const { data, error } = await supabase
    .from('payments')
    .select('id, amount, user_marked_paid_at, organizations!inner(slug)')
    .eq('user_id', userId)
    .eq('status', 'pending')
    .eq('organizations.slug', organizationSlug)
    .not('user_marked_paid_at', 'is', null)
    .order('user_marked_paid_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data?.user_marked_paid_at) return null;

  return {
    amount: data.amount,
    id: data.id,
    userMarkedPaidAt: data.user_marked_paid_at,
  };
}
