import { supabase } from '~/lib/supabase';

import { fetchPaymentUnderReview } from './payment-review';

jest.mock('~/lib/supabase', () => {
  const chain = {
    eq: jest.fn(),
    limit: jest.fn(),
    maybeSingle: jest.fn(),
    not: jest.fn(),
    order: jest.fn(),
    select: jest.fn(),
  };

  for (const method of ['eq', 'limit', 'not', 'order', 'select'] as const) {
    chain[method].mockReturnValue(chain);
  }

  return { supabase: { from: jest.fn(() => chain) } };
});

const mockFrom = jest.mocked(supabase.from);
const mockChain = mockFrom('payments') as unknown as {
  eq: jest.Mock;
  limit: jest.Mock;
  maybeSingle: jest.Mock;
  not: jest.Mock;
  order: jest.Mock;
  select: jest.Mock;
};

describe('fetchPaymentUnderReview', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    for (const method of ['eq', 'limit', 'not', 'order', 'select'] as const) {
      mockChain[method].mockReturnValue(mockChain);
    }
  });

  it('returns the latest pending payment explicitly marked paid by the user', async () => {
    mockChain.maybeSingle.mockResolvedValue({
      data: {
        amount: 36000,
        id: 'payment-1',
        user_marked_paid_at: '2026-07-10T12:00:00Z',
      },
      error: null,
    });

    await expect(fetchPaymentUnderReview('slac', 'user-1')).resolves.toEqual({
      amount: 36000,
      id: 'payment-1',
      userMarkedPaidAt: '2026-07-10T12:00:00Z',
    });

    expect(mockFrom).toHaveBeenCalledWith('payments');
    expect(mockChain.eq).toHaveBeenCalledWith('user_id', 'user-1');
    expect(mockChain.eq).toHaveBeenCalledWith('status', 'pending');
    expect(mockChain.eq).toHaveBeenCalledWith('organizations.slug', 'slac');
    expect(mockChain.not).toHaveBeenCalledWith(
      'user_marked_paid_at',
      'is',
      null,
    );
  });

  it('returns null when no payment is under review', async () => {
    mockChain.maybeSingle.mockResolvedValue({ data: null, error: null });

    await expect(fetchPaymentUnderReview('slac', 'user-1')).resolves.toBeNull();
  });

  it('surfaces query errors', async () => {
    mockChain.maybeSingle.mockResolvedValue({
      data: null,
      error: { message: 'query failed' },
    });

    await expect(fetchPaymentUnderReview('slac', 'user-1')).rejects.toThrow(
      'query failed',
    );
  });
});
