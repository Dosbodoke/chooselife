import { getPaymentObligationRouteParams } from './manual-payment';

describe('payment obligation navigation', () => {
  it('passes the authoritative obligation facts to the PIX screen', () => {
    expect(
      getPaymentObligationRouteParams({
        amount: 12500,
        currency: 'BRL',
        obligationId: 'obligation-id',
        slug: 'slac',
      }),
    ).toEqual({
      amount: '12500',
      currency: 'BRL',
      obligationId: 'obligation-id',
      paymentContext: 'new_member',
      slug: 'slac',
    });
  });

  it('addresses a recurring contribution with the same obligation contract', () => {
    expect(
      getPaymentObligationRouteParams({
        amount: 4500,
        currency: 'BRL',
        obligationId: 'recurring-obligation-id',
        paymentContext: 'subscription_renewal',
        slug: 'slac',
      }),
    ).toEqual({
      amount: '4500',
      currency: 'BRL',
      obligationId: 'recurring-obligation-id',
      paymentContext: 'subscription_renewal',
      slug: 'slac',
    });
  });

  it('never emits a legacy paymentId deep-link parameter', () => {
    const params = getPaymentObligationRouteParams({
      amount: 12500,
      currency: 'BRL',
      obligationId: 'obligation-id',
      slug: 'slac',
    });

    expect(Object.keys(params)).not.toContain('paymentId');
  });
});
