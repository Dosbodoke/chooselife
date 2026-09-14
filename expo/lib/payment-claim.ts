export type PaymentClaimPayerType = 'applicant' | 'other';

export type PaymentClaimStatus = 'under_review' | 'approved' | 'rejected';

export const MAX_PAYMENT_PAYER_NAME_LENGTH = 120;

export function normalizePaymentPayerName(value: string) {
  return value.trim().replace(/\s+/g, ' ');
}

export function getPaymentClaimValidationError({
  payerName,
  payerType,
}: {
  payerName: string;
  payerType: PaymentClaimPayerType;
}) {
  if (payerType === 'applicant') return null;

  const normalizedName = normalizePaymentPayerName(payerName);

  if (!normalizedName) return 'payer_name_required' as const;
  if (normalizedName.length > MAX_PAYMENT_PAYER_NAME_LENGTH) {
    return 'payer_name_too_long' as const;
  }

  return null;
}
