export type MembershipDisplayState =
  | 'active-member'
  | 'become-member'
  | 'loading'
  | 'payment-review-error'
  | 'payment-under-review';

export function getMembershipDisplayState({
  hasPaymentUnderReview,
  isMember,
  isMemberLoading,
  isSignedIn,
  paymentReviewError,
  paymentReviewLoading,
}: {
  hasPaymentUnderReview: boolean;
  isMember: boolean | undefined;
  isMemberLoading: boolean;
  isSignedIn: boolean;
  paymentReviewError: boolean;
  paymentReviewLoading: boolean;
}): MembershipDisplayState {
  if (!isSignedIn) return 'become-member';
  if (isMemberLoading) return 'loading';
  if (isMember) return 'active-member';
  if (paymentReviewLoading) return 'loading';
  if (paymentReviewError) return 'payment-review-error';
  if (hasPaymentUnderReview) return 'payment-under-review';
  return 'become-member';
}
