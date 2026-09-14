import { supabase } from '~/lib/supabase';

import {
  registerPushTokenForProfile,
  unregisterActivePushToken,
} from './push-token-registration';

jest.mock('~/lib/supabase', () => ({
  supabase: { rpc: jest.fn() },
}));

const mockRpc = jest.mocked(supabase.rpc);

describe('push token ownership commands', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('does not register a token while the profile is unavailable', async () => {
    await expect(
      registerPushTokenForProfile({
        expoPushToken: 'ExponentPushToken[test]',
        locale: 'pt',
        profileId: undefined,
      }),
    ).resolves.toBe('skipped');

    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('registers a new token through the authenticated command', async () => {
    mockRpc.mockResolvedValue({ data: 'registered', error: null } as never);

    await expect(
      registerPushTokenForProfile({
        expoPushToken: 'ExponentPushToken[test]',
        locale: 'pt',
        profileId: 'profile-1',
      }),
    ).resolves.toBe('updated');

    expect(mockRpc).toHaveBeenCalledWith('register_push_token', {
      p_language: 'pt',
      p_token: 'ExponentPushToken[test]',
    });
  });

  it('uses the same command for repeated registration and account switching', async () => {
    mockRpc.mockResolvedValue({ data: 'registered', error: null } as never);

    await registerPushTokenForProfile({
      expoPushToken: 'ExponentPushToken[test]',
      locale: 'en',
      profileId: 'profile-2',
    });

    expect(mockRpc).toHaveBeenLastCalledWith('register_push_token', {
      p_language: 'en',
      p_token: 'ExponentPushToken[test]',
    });
  });

  it('unregisters the active token on logout', async () => {
    mockRpc.mockResolvedValue({ data: 'registered', error: null } as never);
    await registerPushTokenForProfile({
      expoPushToken: 'ExponentPushToken[test]',
      locale: 'pt',
      profileId: 'profile-1',
    });

    mockRpc.mockResolvedValue({ data: true, error: null } as never);
    await unregisterActivePushToken();

    expect(mockRpc).toHaveBeenLastCalledWith('unregister_push_token', {
      p_token: 'ExponentPushToken[test]',
    });
  });

  it('surfaces registration failures', async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: { message: 'registration failed' },
    } as never);

    await expect(
      registerPushTokenForProfile({
        expoPushToken: 'ExponentPushToken[test]',
        locale: 'pt',
        profileId: 'profile-1',
      }),
    ).rejects.toThrow('Could not register the push token: registration failed');
  });
});
