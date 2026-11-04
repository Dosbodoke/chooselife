import AsyncStorage from 'expo-sqlite/kv-store';
import PostHog from 'posthog-react-native';

import { MAP_DEFAULT_EXPERIMENT, type ExperimentStorage } from './map-default';
import {
  isWebbingPickerVariant,
  WEBBING_PICKER_EXPERIMENT,
} from './webbing-picker-layout';

let client: PostHog | null | undefined;

/** QA arms get their own storage so they never contaminate real enrollment. */
function experimentStorage(
  experiment: string,
  qaVariant: string | undefined,
): ExperimentStorage {
  const prefix = qaVariant ? `qa:${experiment}:${qaVariant}:` : '';
  return {
    getItem: (key) => AsyncStorage.getItem(`${prefix}${key}`),
    setItem: (key, value) => AsyncStorage.setItem(`${prefix}${key}`, value),
  };
}

export function getMapStyleStorage(): ExperimentStorage {
  const qaVariant = __DEV__
    ? process.env.EXPO_PUBLIC_DEV_MAP_VARIANT
    : undefined;
  return experimentStorage(
    MAP_DEFAULT_EXPERIMENT,
    qaVariant === 'control' || qaVariant === 'illustrated'
      ? qaVariant
      : undefined,
  );
}

export function getWebbingPickerStorage(): ExperimentStorage {
  const qaVariant = __DEV__
    ? process.env.EXPO_PUBLIC_DEV_WEBBING_PICKER_VARIANT
    : undefined;
  return experimentStorage(
    WEBBING_PICKER_EXPERIMENT,
    isWebbingPickerVariant(qaVariant) ? qaVariant : undefined,
  );
}

function getClient() {
  if (client !== undefined) return client;
  const key = process.env.EXPO_PUBLIC_POSTHOG_KEY;
  // Local development must not pollute a production experiment.
  if (!key || __DEV__) return (client = null);
  try {
    client = new PostHog(key, {
      host: process.env.EXPO_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com',
      customStorage: AsyncStorage,
      captureAppLifecycleEvents: false,
      capturePushNotificationSubscriptions: false,
      enableSessionReplay: false,
      disableSurveys: true,
      errorTracking: { autocapture: false },
      personProfiles: 'never',
      disableGeoip: true,
      sendFeatureFlagEvent: false,
      preloadFeatureFlags: false,
      featureFlagsRequestTimeoutMs: 1500,
      fetchRetryCount: 0,
      maxQueueSize: 200,
    });
  } catch {
    client = null;
  }
  return client;
}

export function getMapExperimentVariant(): Promise<unknown> {
  // QA-only override; never sends events or affects a release build.
  return getExperimentVariant(
    MAP_DEFAULT_EXPERIMENT,
    __DEV__ ? process.env.EXPO_PUBLIC_DEV_MAP_VARIANT : undefined,
  );
}

export function getWebbingPickerVariant(): Promise<unknown> {
  return getExperimentVariant(
    WEBBING_PICKER_EXPERIMENT,
    __DEV__ ? process.env.EXPO_PUBLIC_DEV_WEBBING_PICKER_VARIANT : undefined,
  );
}

async function getExperimentVariant(
  flagKey: string,
  devOverride: string | undefined,
): Promise<unknown> {
  if (__DEV__) return devOverride;
  const posthog = getClient();
  if (!posthog) return undefined;

  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      (async () => {
        await posthog.ready();
        // Read only fresh responses, so stopped flags aren't revived from cache.
        const flags = await posthog.reloadFeatureFlagsAsync();
        return flags?.[flagKey];
      })(),
      new Promise<undefined>((resolve) => {
        timeout = setTimeout(() => resolve(undefined), 1800);
      }),
    ]);
  } catch {
    return undefined;
  } finally {
    clearTimeout(timeout);
  }
}

export function captureGrowthEvent(
  event: string,
  properties: Record<string, string | number | boolean>,
) {
  if (__DEV__ && process.env.EXPO_PUBLIC_DEV_GROWTH_DEBUG === 'true') {
    console.info('[growth]', event, properties);
  }
  try {
    getClient()?.capture(event, properties);
  } catch {
    // Analytics must never interrupt browsing or navigation.
  }
}

export function flushGrowthEvents() {
  void getClient()
    ?.flush()
    .catch(() => undefined);
}
