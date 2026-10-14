import AsyncStorage from 'expo-sqlite/kv-store';
import PostHog from 'posthog-react-native';

import { MAP_DEFAULT_EXPERIMENT, type ExperimentStorage } from './map-default';

let client: PostHog | null | undefined;

export function getMapStyleStorage(): ExperimentStorage {
  const qaVariant = __DEV__
    ? process.env.EXPO_PUBLIC_DEV_MAP_VARIANT
    : undefined;
  const prefix =
    qaVariant === 'control' || qaVariant === 'illustrated'
      ? `qa:${MAP_DEFAULT_EXPERIMENT}:${qaVariant}:`
      : '';
  return {
    getItem: (key) => AsyncStorage.getItem(`${prefix}${key}`),
    setItem: (key, value) => AsyncStorage.setItem(`${prefix}${key}`, value),
  };
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

export async function getMapExperimentVariant(): Promise<unknown> {
  if (__DEV__) {
    // QA-only override; never sends events or affects a release build.
    return process.env.EXPO_PUBLIC_DEV_MAP_VARIANT;
  }
  const posthog = getClient();
  if (!posthog) return undefined;

  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      (async () => {
        await posthog.ready();
        // Read only fresh responses, so stopped flags aren't revived from cache.
        const flags = await posthog.reloadFeatureFlagsAsync();
        return flags?.[MAP_DEFAULT_EXPERIMENT];
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
