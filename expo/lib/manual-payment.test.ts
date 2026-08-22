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
});
