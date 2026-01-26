import AsyncStorage from 'expo-sqlite/kv-store';

import { getLastOtaCheckTime, setLastOtaCheckTime } from '../utils/storage';

// Type the mocked AsyncStorage
const mockAsyncStorage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;

describe('storage utilities', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('setLastOtaCheckTime', () => {
    it('stores current timestamp', async () => {
      const now = Date.now();
      jest.setSystemTime(now);

      await setLastOtaCheckTime();

      expect(mockAsyncStorage.setItem).toHaveBeenCalledWith(
        'ota_last_check_timestamp',
        now.toString()
      );
    });
  });

  describe('getLastOtaCheckTime', () => {
    it('returns null when no timestamp is stored', async () => {
      mockAsyncStorage.getItem.mockResolvedValue(null);

      const result = await getLastOtaCheckTime();

      expect(result).toBeNull();
    });

    it('returns the stored timestamp as a number', async () => {
      const timestamp = 1704067200000;
      mockAsyncStorage.getItem.mockResolvedValue(timestamp.toString());

      const result = await getLastOtaCheckTime();

      expect(result).toBe(timestamp);
    });
  });
});
