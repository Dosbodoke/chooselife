import {
  getPaymentClaimValidationError,
  normalizePaymentPayerName,
} from './payment-claim';

describe('payment claim payer details', () => {
  it('normalizes leading, trailing, and repeated whitespace', () => {
    expect(normalizePaymentPayerName('  Ana   Maria\nSilva  ')).toBe(
      'Ana Maria Silva',
    );
  });

  it('uses the applicant as the default without requiring a name', () => {
    expect(
      getPaymentClaimValidationError({ payerName: '', payerType: 'applicant' }),
    ).toBeNull();
  });

  it('requires a name when another person paid', () => {
    expect(
      getPaymentClaimValidationError({ payerName: '   ', payerType: 'other' }),
    ).toBe('payer_name_required');
  });

  it('enforces the server-aligned payer name limit', () => {
    expect(
      getPaymentClaimValidationError({
        payerName: 'a'.repeat(121),
        payerType: 'other',
      }),
    ).toBe('payer_name_too_long');
  });
});
