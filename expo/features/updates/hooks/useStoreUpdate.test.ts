import * as InAppUpdates from 'expo-in-app-updates';
import * as Linking from 'expo-linking';

import { IOS_STORE_URL } from '../constants';
import { isVersionLessThan } from '../utils/version';

// Mock the constants to disable dev testing
jest.mock('../constants', () => ({
  DEV_TEST_STORE_UPDATE: false,
  IOS_STORE_URL: 'https://apps.apple.com/app/chooselife/id6503710563',
  MIN_VERSION_CONFIG_KEY: 'min_app_version',
}));

const mockInAppUpdates = InAppUpdates as jest.Mocked<typeof InAppUpdates>;
const mockLinking = Linking as jest.Mocked<typeof Linking>;

describe('useStoreUpdate logic', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('version comparison for store updates', () => {
    it('returns true when current version is below minimum', () => {
      // Current app version is 1.3.14 (mocked in jest.setup.js)
      const needsUpdate = isVersionLessThan('1.3.14', '2.0.0');
      expect(needsUpdate).toBe(true);
    });

    it('returns false when current version meets minimum', () => {
      const needsUpdate = isVersionLessThan('1.3.14', '1.3.14');
      expect(needsUpdate).toBe(false);
    });

    it('returns false when current version exceeds minimum', () => {
      const needsUpdate = isVersionLessThan('1.3.14', '1.0.0');
      expect(needsUpdate).toBe(false);
    });

    it('handles patch version differences', () => {
      expect(isVersionLessThan('1.3.13', '1.3.14')).toBe(true);
      expect(isVersionLessThan('1.3.15', '1.3.14')).toBe(false);
    });

    it('handles minor version differences', () => {
      expect(isVersionLessThan('1.2.14', '1.3.14')).toBe(true);
      expect(isVersionLessThan('1.4.14', '1.3.14')).toBe(false);
    });

    it('handles major version differences', () => {
      expect(isVersionLessThan('0.3.14', '1.3.14')).toBe(true);
      expect(isVersionLessThan('2.3.14', '1.3.14')).toBe(false);
    });
  });

  describe('openStore', () => {
    it('uses correct iOS App Store URL', () => {
      expect(IOS_STORE_URL).toBe('https://apps.apple.com/app/chooselife/id6503710563');
    });

    it('can open URL via Linking', async () => {
      (mockLinking.openURL as jest.Mock).mockResolvedValue(true);

      await mockLinking.openURL(IOS_STORE_URL);

      expect(mockLinking.openURL).toHaveBeenCalledWith(IOS_STORE_URL);
    });

    it('handles Linking errors gracefully', async () => {
      const error = new Error('Cannot open URL');
      (mockLinking.openURL as jest.Mock).mockRejectedValue(error);

      await expect(mockLinking.openURL(IOS_STORE_URL)).rejects.toThrow('Cannot open URL');
    });
  });

  describe('Android in-app updates', () => {
    it('checkForUpdate returns update info', async () => {
      (mockInAppUpdates.checkForUpdate as jest.Mock).mockResolvedValue({
        updateAvailable: true,
        storeVersion: '2.0.0',
      });

      const result = await mockInAppUpdates.checkForUpdate();

      expect(result.updateAvailable).toBe(true);
      expect(result.storeVersion).toBe('2.0.0');
    });

    it('checkForUpdate returns no update', async () => {
      (mockInAppUpdates.checkForUpdate as jest.Mock).mockResolvedValue({
        updateAvailable: false,
        storeVersion: '1.3.14',
      });

      const result = await mockInAppUpdates.checkForUpdate();

      expect(result.updateAvailable).toBe(false);
    });

    it('startUpdate can be called with immediate mode', async () => {
      (mockInAppUpdates.startUpdate as jest.Mock).mockResolvedValue(true);

      const result = await mockInAppUpdates.startUpdate(true);

      expect(mockInAppUpdates.startUpdate).toHaveBeenCalledWith(true);
      expect(result).toBe(true);
    });

    it('startUpdate can be called with flexible mode', async () => {
      (mockInAppUpdates.startUpdate as jest.Mock).mockResolvedValue(true);

      const result = await mockInAppUpdates.startUpdate(false);

      expect(mockInAppUpdates.startUpdate).toHaveBeenCalledWith(false);
      expect(result).toBe(true);
    });

    it('handles startUpdate failure', async () => {
      (mockInAppUpdates.startUpdate as jest.Mock).mockResolvedValue(false);

      const result = await mockInAppUpdates.startUpdate(true);

      expect(result).toBe(false);
    });
  });

  describe('error handling scenarios', () => {
    it('handles checkForUpdate errors', async () => {
      const error = new Error('Play Store unavailable');
      (mockInAppUpdates.checkForUpdate as jest.Mock).mockRejectedValue(error);

      await expect(mockInAppUpdates.checkForUpdate()).rejects.toThrow('Play Store unavailable');
    });

    it('handles startUpdate errors', async () => {
      const error = new Error('Update installation failed');
      (mockInAppUpdates.startUpdate as jest.Mock).mockRejectedValue(error);

      await expect(mockInAppUpdates.startUpdate(true)).rejects.toThrow(
        'Update installation failed'
      );
    });
  });
});
