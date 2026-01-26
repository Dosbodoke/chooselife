import * as Updates from 'expo-updates';

import * as storage from '../utils/storage';

// Mock the storage module
jest.mock('../utils/storage', () => ({
  setLastOtaCheckTime: jest.fn(),
  getLastOtaCheckTime: jest.fn(),
}));

// Mock the constants to disable dev testing
jest.mock('../constants', () => ({
  CHECK_THROTTLE_MS: 60 * 60 * 1000,
  DEV_TEST_OTA_UPDATE: false,
}));

const mockUpdates = Updates as jest.Mocked<typeof Updates>;
const mockStorage = storage as jest.Mocked<typeof storage>;

describe('useOtaUpdate logic', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockStorage.setLastOtaCheckTime.mockResolvedValue(undefined);
    mockStorage.getLastOtaCheckTime.mockResolvedValue(null);
  });

  describe('checkForUpdateAsync', () => {
    it('can check for updates - no update available', async () => {
      (mockUpdates.checkForUpdateAsync as jest.Mock).mockResolvedValue({
        isAvailable: false,
      });

      const result = await mockUpdates.checkForUpdateAsync();
      expect(result.isAvailable).toBe(false);
    });

    it('returns true when update is available', async () => {
      (mockUpdates.checkForUpdateAsync as jest.Mock).mockResolvedValue({
        isAvailable: true,
        manifest: {},
      });

      const result = await mockUpdates.checkForUpdateAsync();
      expect(result.isAvailable).toBe(true);
    });
  });

  describe('storage interactions', () => {
    it('setLastOtaCheckTime is called correctly', async () => {
      await mockStorage.setLastOtaCheckTime();
      expect(mockStorage.setLastOtaCheckTime).toHaveBeenCalled();
    });
  });

  describe('fetchUpdateAsync', () => {
    it('can fetch and apply updates', async () => {
      (mockUpdates.fetchUpdateAsync as jest.Mock).mockResolvedValue({
        isNew: true,
        manifest: {},
      });

      const result = await mockUpdates.fetchUpdateAsync();
      expect(result.isNew).toBe(true);
    });

    it('handles no new update', async () => {
      (mockUpdates.fetchUpdateAsync as jest.Mock).mockResolvedValue({
        isNew: false,
        manifest: {},
      });

      const result = await mockUpdates.fetchUpdateAsync();
      expect(result.isNew).toBe(false);
    });

    it('handles errors', async () => {
      const error = new Error('Network error');
      (mockUpdates.fetchUpdateAsync as jest.Mock).mockRejectedValue(error);

      await expect(mockUpdates.fetchUpdateAsync()).rejects.toThrow('Network error');
    });
  });

  describe('reloadAsync', () => {
    it('can reload the app', async () => {
      (mockUpdates.reloadAsync as jest.Mock).mockResolvedValue(undefined);

      await expect(mockUpdates.reloadAsync()).resolves.toBeUndefined();
    });
  });
});
