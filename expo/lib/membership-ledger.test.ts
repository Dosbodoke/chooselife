import { supabase } from '~/lib/supabase';

import { fetchMembershipBillingLedger } from './membership-ledger';

jest.mock('~/lib/supabase', () => ({
  supabase: {
    rpc: jest.fn(),
  },
}));

const mockRpc = jest.mocked(supabase.rpc);

describe('fetchMembershipBillingLedger', () => {
  beforeEach(() => {
    mockRpc.mockReset();
  });

  it('returns null when the signed-in person has not started joining yet', async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: {
        code: '42501',
        details: null,
        hint: null,
        message: 'Membership Ledger was not found.',
      },
    } as never);

    await expect(fetchMembershipBillingLedger('org-1')).resolves.toBeNull();
  });

  it('keeps unexpected Ledger failures actionable', async () => {
    const error = {
      code: '08006',
      details: null,
      hint: null,
      message: 'Connection failure',
    };
    mockRpc.mockResolvedValue({ data: null, error } as never);

    await expect(fetchMembershipBillingLedger('org-1')).rejects.toBe(error);
  });
});
