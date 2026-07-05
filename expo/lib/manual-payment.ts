export const MANUAL_PAYMENT_PIX_COPY_PASTE =
  process.env.EXPO_PUBLIC_MEMBERSHIP_PIX_COPY_PASTE ?? '';

export function getManualPaymentRouteParams({
  amount,
  paymentId,
  paymentContext,
  slug,
}: {
  amount?: number;
  paymentId: string;
  paymentContext: 'new_member' | 'subscription_renewal';
  slug?: string;
}) {
  return {
    amount: amount == null ? undefined : String(amount),
    paymentContext,
    paymentId,
    slug,
  };
}
