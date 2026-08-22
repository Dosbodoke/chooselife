import { supabase } from '~/lib/supabase';

import { registerPushTokenForProfile } from './push-token-registration';

jest.mock('~/lib/supabase', () => {
  const chain = {
    eq: jest.fn(),
    insert: jest.fn(),
    maybeSingle: jest.fn(),
    select: jest.fn(),
    update: jest.fn(),
  };

  for (const method of ['eq', 'select', 'update'] as const) {
    chain[method].mockReturnValue(chain);
  }

  return { supabase: { from: jest.fn(() => chain) } };
});

const mockFrom = jest.mocked(supabase.from);
const mockChain = mockFrom('push_tokens') as unknown as {
  eq: jest.Mock;
  insert: jest.Mock;
  maybeSingle: jest.Mock;
  select: jest.Mock;
  update: jest.Mock;
};

describe('registerPushTokenForProfile', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    for (const method of ['eq', 'select', 'update'] as const) {
      mockChain[method].mockReturnValue(mockChain);
    }
  });

  it('does not insert an unowned token while the profile is unavailable', async () => {
    await expect(
      registerPushTokenForProfile({
        expoPushToken: 'ExponentPushToken[test]',
        locale: 'pt',
        profileId: undefined,
      }),
    ).resolves.toBe('skipped');

    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('inserts a new token with its signed-in owner', async () => {
    mockChain.maybeSingle.mockResolvedValue({ data: null, error: null });
    mockChain.insert.mockResolvedValue({ error: null });

    await expect(
      registerPushTokenForProfile({
        expoPushToken: 'ExponentPushToken[test]',
        locale: 'pt',
        profileId: 'profile-1',
      }),
    ).resolves.toBe('inserted');

    expect(mockChain.insert).toHaveBeenCalledWith({
      language: 'pt',
      profile_id: 'profile-1',
      token: 'ExponentPushToken[test]',
    });
  });

  it('updates only a token already owned by the signed-in profile', async () => {
    mockChain.maybeSingle.mockResolvedValue({
      data: { id: 12, profile_id: 'profile-1' },
      error: null,
    });

    await expect(
      registerPushTokenForProfile({
        expoPushToken: 'ExponentPushToken[test]',
        locale: 'en',
        profileId: 'profile-1',
      }),
    ).resolves.toBe('updated');

    expect(mockChain.update).toHaveBeenCalledWith(
      expect.objectContaining({ language: 'en' }),
    );
    expect(mockChain.eq).toHaveBeenLastCalledWith('id', 12);
  });

  it('does not reassign a token owned by another profile', async () => {
    mockChain.maybeSingle.mockResolvedValue({
      data: { id: 12, profile_id: 'profile-2' },
      error: null,
    });

    await expect(
      registerPushTokenForProfile({
        expoPushToken: 'ExponentPushToken[test]',
        locale: 'pt',
        profileId: 'profile-1',
      }),
    ).rejects.toThrow(
      'This push token is already associated with a different profile.',
    );

    expect(mockChain.update).not.toHaveBeenCalled();
    expect(mockChain.insert).not.toHaveBeenCalled();
  });

  it('surfaces database failures', async () => {
    mockChain.maybeSingle.mockResolvedValue({
      data: null,
      error: { message: 'lookup failed' },
    });

    await expect(
      registerPushTokenForProfile({
        expoPushToken: 'ExponentPushToken[test]',
        locale: 'pt',
        profileId: 'profile-1',
      }),
    ).rejects.toThrow('Could not look up the push token: lookup failed');
  });
});
