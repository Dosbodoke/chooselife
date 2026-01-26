import Constants from 'expo-constants';
import * as InAppUpdates from 'expo-in-app-updates';
import * as Linking from 'expo-linking';
import { useCallback, useEffect, useState } from 'react';
import { Platform } from 'react-native';

import { supabase } from '~/lib/supabase';

import { DEV_TEST_STORE_UPDATE, IOS_STORE_URL, MIN_VERSION_CONFIG_KEY } from '../constants';
import { isVersionLessThan } from '../utils/version';

// Type for min_app_version config value stored in app_config table
interface MinVersionConfig {
  ios: string;
  android: string;
}

// Response type for app_config query (table added in migration 20260125142922)
interface AppConfigResponse {
  value: MinVersionConfig;
}

export interface StoreUpdateState {
  isChecking: boolean;
  storeUpdateRequired: boolean;
  error: Error | null;
}

export interface StoreUpdateActions {
  checkStoreVersion: () => Promise<void>;
  openStore: () => Promise<void>;
  triggerAndroidUpdate: () => Promise<void>;
}

export function useStoreUpdate(): StoreUpdateState & StoreUpdateActions {
  const [state, setState] = useState<StoreUpdateState>({
    isChecking: false,
    storeUpdateRequired: false,
    error: null,
  });

  const checkStoreVersion = useCallback(async () => {
    // Dev testing mode - simulate store update required
    if (DEV_TEST_STORE_UPDATE) {
      setState((prev) => ({
        ...prev,
        storeUpdateRequired: true,
        isChecking: false,
      }));
      return;
    }

    setState((prev) => ({ ...prev, isChecking: true, error: null }));

    try {
      // Query app_config table (added in migration 20260125142922_app_config.sql)
      // Using type assertion since table isn't in generated types yet
      const { data, error } = (await supabase
        .from('app_config' as 'entry')
        .select('value')
        .eq('key', MIN_VERSION_CONFIG_KEY)
        .single()) as { data: AppConfigResponse | null; error: Error | null };

      if (error) {
        // If table doesn't exist or row not found, assume no update required
        const pgError = error as { code?: string };
        if (pgError.code === 'PGRST116' || pgError.code === '42P01') {
          setState((prev) => ({
            ...prev,
            storeUpdateRequired: false,
            isChecking: false,
          }));
          return;
        }
        throw error;
      }

      const minVersionConfig = data?.value;
      if (!minVersionConfig) {
        setState((prev) => ({
          ...prev,
          storeUpdateRequired: false,
          isChecking: false,
        }));
        return;
      }

      const currentVersion = Constants.expoConfig?.version;
      const minVersion = Platform.OS === 'ios' ? minVersionConfig.ios : minVersionConfig.android;

      const needsUpdate = isVersionLessThan(currentVersion, minVersion);

      setState((prev) => ({
        ...prev,
        storeUpdateRequired: needsUpdate,
        isChecking: false,
      }));
    } catch (error) {
      setState((prev) => ({
        ...prev,
        error: error instanceof Error ? error : new Error('Failed to check store version'),
        isChecking: false,
      }));
    }
  }, []);

  const openStore = useCallback(async () => {
    const bundleId =
      Constants.expoConfig?.ios?.bundleIdentifier ?? 'com.bodok.chooselife';

    try {
      // Look up the App Store entry by bundle ID so we don't hardcode an Apple ID
      const res = await fetch(
        `https://itunes.apple.com/lookup?bundleId=${bundleId}`
      );
      const data = await res.json();
      const trackId = data.results?.[0]?.trackId;

      if (trackId) {
        // itms-apps:// opens the App Store app directly, skipping Safari
        await Linking.openURL(`itms-apps://apps.apple.com/app/id${trackId}`);
        return;
      }
    } catch {
      // Fall through to hardcoded URL
    }

    await Linking.openURL(IOS_STORE_URL);
  }, []);

  const triggerAndroidUpdate = useCallback(async () => {
    if (Platform.OS !== 'android') return;

    try {
      // Check if an update is available via Play Store
      const updateInfo = await InAppUpdates.checkForUpdate();

      if (updateInfo.updateAvailable) {
        // Start immediate update flow (blocking) - true means immediate
        await InAppUpdates.startUpdate(true);
      }
    } catch (error) {
      // If in-app update fails, fall back to opening Play Store
      const storeUrl = `market://details?id=com.chooselife.app`;
      const webUrl = 'https://play.google.com/store/apps/details?id=com.chooselife.app';

      try {
        await Linking.openURL(storeUrl);
      } catch {
        await Linking.openURL(webUrl);
      }
    }
  }, []);

  // Check store version on mount
  useEffect(() => {
    checkStoreVersion();
  }, [checkStoreVersion]);

  return {
    ...state,
    checkStoreVersion,
    openStore,
    triggerAndroidUpdate,
  };
}
