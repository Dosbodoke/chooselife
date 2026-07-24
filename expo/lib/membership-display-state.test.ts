import { getMembershipDisplayState } from './membership-display-state';

const baseState = {
  hasPaymentUnderReview: false,
  isMember: false,
  isMemberLoading: false,
  isSignedIn: true,
  paymentReviewError: false,
  paymentReviewLoading: false,
};

describe('getMembershipDisplayState', () => {
  it('gives an active membership precedence over stale payment query state', () => {
    expect(
      getMembershipDisplayState({
        ...baseState,
        isMember: true,
        paymentReviewError: true,
        paymentReviewLoading: true,
      }),
    ).toBe('active-member');
  });

  it.each([
    [{ isMemberLoading: true }, 'loading'],
    [{ paymentReviewLoading: true }, 'loading'],
    [{ paymentReviewError: true }, 'payment-review-error'],
    [{ hasPaymentUnderReview: true }, 'payment-under-review'],
    [{}, 'become-member'],
  ] as const)('selects the expected non-member state', (input, expected) => {
    expect(getMembershipDisplayState({ ...baseState, ...input })).toBe(
      expected,
    );
  });

  it('shows the become-member state to signed-out users', () => {
    expect(
      getMembershipDisplayState({
        ...baseState,
        isMemberLoading: true,
        isSignedIn: false,
        paymentReviewError: true,
      }),
    ).toBe('become-member');
  });
});
