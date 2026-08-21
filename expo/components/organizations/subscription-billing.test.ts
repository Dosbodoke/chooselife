import {
  findPendingRenewalPayment,
  formatBillingAmount,
  formatBillingDate,
} from './subscription-billing';

describe('subscription billing presentation', () => {
  it('finds a renewal payment created after the latest successful payment', () => {
    const payments = [
      {
        id: 'latest-renewal',
        amount: 4500,
        status: 'pending',
        created_at: '2026-08-20T12:00:00.000Z',
      },
      {
        id: 'last-paid-period',
        amount: 4500,
        status: 'succeeded',
        created_at: '2026-07-20T12:00:00.000Z',
      },
      {
        id: 'stale-pending',
        amount: 4500,
        status: 'pending',
        created_at: '2026-06-20T12:00:00.000Z',
      },
    ];

    expect(findPendingRenewalPayment(payments)?.id).toBe('latest-renewal');
  });

  it('returns the newest pending payment when there is no successful payment', () => {
    const payments = [
      {
        id: 'older',
        amount: 4500,
        status: 'pending',
        created_at: '2026-08-19T12:00:00.000Z',
      },
      {
        id: 'newer',
        amount: 4500,
        status: 'pending',
        created_at: '2026-08-20T12:00:00.000Z',
      },
    ];

    expect(findPendingRenewalPayment(payments)?.id).toBe('newer');
  });

  it('formats the bill amount in Brazilian reais', () => {
    expect(formatBillingAmount(4590)).toBe('R$\u00a045,90');
  });

  it('formats a valid billing date and safely handles missing dates', () => {
    expect(formatBillingDate('2026-08-25T12:00:00.000Z')).toBe(
      '25 de agosto de 2026',
    );
    expect(formatBillingDate(null)).toBeNull();
    expect(formatBillingDate('not-a-date')).toBeNull();
  });
});
