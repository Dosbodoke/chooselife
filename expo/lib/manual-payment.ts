export function getPaymentObligationRouteParams({
  amount,
  currency,
  obligationId,
  paymentContext = 'new_member',
  slug,
}: {
  amount: number;
  currency: string;
  obligationId: string;
  paymentContext?: 'new_member' | 'subscription_renewal';
  slug: string;
}) {
  return {
    amount: String(amount),
    currency,
    obligationId,
    paymentContext,
    slug,
  };
}
