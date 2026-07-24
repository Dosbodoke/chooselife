import * as SecureStore from 'expo-secure-store';
import AsyncStorage from 'expo-sqlite/kv-store';

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    auth: {
      startAutoRefresh: jest.fn(),
      stopAutoRefresh: jest.fn(),
    },
  })),
}));

jest.mock('react-native-url-polyfill/auto', () => ({}));
jest.mock('react-native-get-random-values', () => ({}));

jest.mock('expo-secure-store', () => ({
  __esModule: true,
  AFTER_FIRST_UNLOCK: 'AFTER_FIRST_UNLOCK',
  deleteItemAsync: jest.fn(),
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
}));

const mockAsyncStorage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;
const mockSecureStore = SecureStore as jest.Mocked<typeof SecureStore>;
const { LargeSecureStore } =
  jest.requireActual<typeof import('./supabase')>('./supabase');

describe('LargeSecureStore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('returns null when SecureStore cannot read the encryption key', async () => {
    mockAsyncStorage.getItem.mockResolvedValue('encrypted-session');
    mockSecureStore.getItemAsync.mockRejectedValue(
      new Error('User interaction is not allowed.'),
    );

    await expect(
      new LargeSecureStore().getItem('supabase.auth.token'),
    ).resolves.toBeNull();

    expect(mockSecureStore.getItemAsync).toHaveBeenCalledWith(
      'supabase.auth.token',
      { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK },
    );
    expect(console.warn).toHaveBeenCalledWith(
      'Unable to read secure auth storage:',
      expect.any(Error),
    );
  });

  it('stores encryption keys with after-first-unlock keychain accessibility', async () => {
    await new LargeSecureStore().setItem('supabase.auth.token', 'session');

    expect(mockSecureStore.setItemAsync).toHaveBeenCalledWith(
      'supabase.auth.token',
      expect.any(String),
      { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK },
    );
    expect(mockAsyncStorage.setItem).toHaveBeenCalledWith(
      'supabase.auth.token',
      expect.any(String),
    );
  });
});
