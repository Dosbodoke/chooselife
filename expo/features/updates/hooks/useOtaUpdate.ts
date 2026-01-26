import * as Updates from 'expo-updates';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus } from 'react-native';

import { CHECK_THROTTLE_MS, DEV_TEST_OTA_UPDATE } from '../constants';
import { getLastOtaCheckTime, setLastOtaCheckTime } from '../utils/storage';

export interface OtaUpdateState {
  isChecking: boolean;
  isDownloading: boolean;
  downloadProgress: number;
  updateAvailable: boolean;
  error: Error | null;
  showPrompt: boolean;
}

export interface OtaUpdateActions {
  checkForUpdates: () => Promise<void>;
  downloadAndApply: () => Promise<void>;
  downloadInBackground: () => Promise<void>;
}

export function useOtaUpdate(): OtaUpdateState & OtaUpdateActions {
  const [state, setState] = useState<OtaUpdateState>({
    isChecking: false,
    isDownloading: false,
    downloadProgress: 0,
    updateAvailable: false,
    error: null,
    showPrompt: false,
  });

  const appState = useRef(AppState.currentState);

  const checkForUpdates = useCallback(async (isInitialCheck = false) => {
    // Dev testing mode - simulate an available update (bypasses storage check)
    if (DEV_TEST_OTA_UPDATE) {
      setState((prev) => ({
        ...prev,
        updateAvailable: true,
        showPrompt: true, // Always show in test mode
        isChecking: false,
      }));
      return;
    }

    // Don't check in dev mode or if already checking/downloading
    if (__DEV__ || !Updates.isEnabled) {
      return;
    }

    setState((prev) => ({ ...prev, isChecking: true, error: null }));

    try {
      const update = await Updates.checkForUpdateAsync();

      if (update.isAvailable) {
        setState((prev) => ({
          ...prev,
          updateAvailable: true,
          showPrompt: true,
          isChecking: false,
        }));
      } else {
        setState((prev) => ({
          ...prev,
          updateAvailable: false,
          showPrompt: false,
          isChecking: false,
        }));
      }

      // Record the check time
      await setLastOtaCheckTime();
    } catch (error) {
      setState((prev) => ({
        ...prev,
        error: error instanceof Error ? error : new Error('Failed to check for updates'),
        isChecking: false,
      }));
    }
  }, []);

  const downloadAndApply = useCallback(async () => {
    // Dev testing mode - simulate download progress
    if (DEV_TEST_OTA_UPDATE) {
      setState((prev) => ({ ...prev, isDownloading: true, error: null, downloadProgress: 0 }));

      // Simulate download progress
      for (let i = 0; i <= 100; i += 10) {
        await new Promise((resolve) => setTimeout(resolve, 200));
        setState((prev) => ({ ...prev, downloadProgress: i }));
      }

      // Simulate completion
      await new Promise((resolve) => setTimeout(resolve, 500));
      setState((prev) => ({
        ...prev,
        isDownloading: false,
        showPrompt: false,
        updateAvailable: false,
        downloadProgress: 0,
      }));
      return;
    }

    if (__DEV__ || !Updates.isEnabled) {
      return;
    }

    setState((prev) => ({ ...prev, isDownloading: true, error: null, downloadProgress: 0 }));

    try {
      const result = await Updates.fetchUpdateAsync();

      if (result.isNew) {
        setState((prev) => ({ ...prev, downloadProgress: 100 }));
        // Small delay to show 100% progress
        await new Promise((resolve) => setTimeout(resolve, 300));
        await Updates.reloadAsync();
      } else {
        setState((prev) => ({
          ...prev,
          isDownloading: false,
          showPrompt: false,
          updateAvailable: false,
        }));
      }
    } catch (error) {
      setState((prev) => ({
        ...prev,
        error: error instanceof Error ? error : new Error('Failed to download update'),
        isDownloading: false,
      }));
    }
  }, []);

  const downloadInBackground = useCallback(async () => {
    // Dismiss the prompt immediately, download silently in background
    setState((prev) => ({ ...prev, showPrompt: false }));

    if (DEV_TEST_OTA_UPDATE || __DEV__ || !Updates.isEnabled) {
      return;
    }

    try {
      // Download without reloading — update applies on next app launch
      await Updates.fetchUpdateAsync();
    } catch {
      // Silent failure is fine — expo-updates will retry on next launch
    }
  }, []);

  // Check for updates on mount
  useEffect(() => {
    checkForUpdates(true);
  }, [checkForUpdates]);

  // Check for updates when app comes to foreground (throttled)
  useEffect(() => {
    const handleAppStateChange = async (nextAppState: AppStateStatus) => {
      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        // Throttle foreground checks
        const lastCheck = await getLastOtaCheckTime();
        const now = Date.now();

        if (!lastCheck || now - lastCheck > CHECK_THROTTLE_MS) {
          checkForUpdates(false);
        }
      }
      appState.current = nextAppState;
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      subscription.remove();
    };
  }, [checkForUpdates]);

  return {
    ...state,
    checkForUpdates: () => checkForUpdates(false),
    downloadAndApply,
    downloadInBackground,
  };
}
