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

  it('emits exactly the obligation route contract and no legacy state', () => {
    const params = getPaymentObligationRouteParams({
      amount: 12500,
      currency: 'BRL',
      obligationId: 'obligation-id',
      slug: 'slac',
    });

    // Exhaustive on purpose: the retired flow addressed the PIX screen by a
    // `payments` row id, and the screen no longer has a branch that could read
    // one. Any extra key here would be a resurrected deep-link parameter.
    expect(Object.keys(params).sort()).toEqual([
      'amount',
      'currency',
      'obligationId',
      'paymentContext',
      'slug',
    ]);
  });
});
