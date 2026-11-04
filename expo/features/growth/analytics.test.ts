import AsyncStorage from 'expo-sqlite/kv-store';
import PostHog from 'posthog-react-native';

import { MAP_DEFAULT_EXPERIMENT } from './map-default';
import { WEBBING_PICKER_EXPERIMENT } from './webbing-picker-layout';

jest.mock('posthog-react-native', () => ({
  __esModule: true,
  default: jest.fn(),
}));

const constructor = jest.mocked(PostHog);
const originalEnv = { ...process.env };

async function load() {
  let analytics!: typeof import('./analytics');
  await jest.isolateModulesAsync(async () => {
    analytics = await import('./analytics');
  });
  return analytics;
}

describe('webbing picker flag', () => {
  beforeEach(() => {
    (globalThis as Record<string, unknown>).__DEV__ = false;
    process.env.EXPO_PUBLIC_POSTHOG_KEY = 'phc_test';
    delete process.env.EXPO_PUBLIC_DEV_WEBBING_PICKER_VARIANT;
    jest.clearAllMocks();
  });
  afterEach(() => {
    (globalThis as Record<string, unknown>).__DEV__ = true;
    process.env = { ...originalEnv };
  });

  it('reads its own flag key in production and ignores dev overrides', async () => {
    process.env.EXPO_PUBLIC_DEV_WEBBING_PICKER_VARIANT = 'control';
    const instance = {
      ready: jest.fn().mockResolvedValue(undefined),
      reloadFeatureFlagsAsync: jest.fn().mockResolvedValue({
        [MAP_DEFAULT_EXPERIMENT]: 'illustrated',
        [WEBBING_PICKER_EXPERIMENT]: 'wide',
      }),
    };
    constructor.mockImplementation(() => instance as unknown as PostHog);
    expect(await (await load()).getWebbingPickerVariant()).toBe('wide');
  });

  it('uses a dev override in isolated QA storage without any transport', async () => {
    (globalThis as Record<string, unknown>).__DEV__ = true;
    process.env.EXPO_PUBLIC_DEV_WEBBING_PICKER_VARIANT = 'wide';
    const analytics = await load();
    expect(await analytics.getWebbingPickerVariant()).toBe('wide');
    await analytics
      .getWebbingPickerStorage()
      .setItem(`experiment:${WEBBING_PICKER_EXPERIMENT}`, 'wide');
    expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      `qa:${WEBBING_PICKER_EXPERIMENT}:wide:experiment:${WEBBING_PICKER_EXPERIMENT}`,
      'wide',
    );
    expect(constructor).not.toHaveBeenCalled();
  });
});

describe('growth transport', () => {
  beforeEach(() => {
    (globalThis as Record<string, unknown>).__DEV__ = false;
    process.env.EXPO_PUBLIC_POSTHOG_KEY = 'phc_test';
    delete process.env.EXPO_PUBLIC_DEV_MAP_VARIANT;
    jest.clearAllMocks();
  });
  afterEach(() => {
    (globalThis as Record<string, unknown>).__DEV__ = true;
    process.env = { ...originalEnv };
    jest.useRealTimers();
  });

  it('does not initialize analytics without a project key', async () => {
    delete process.env.EXPO_PUBLIC_POSTHOG_KEY;
    const analytics = await load();
    expect(await analytics.getMapExperimentVariant()).toBeUndefined();
    analytics.captureGrowthEvent('explore_viewed', {});
    expect(constructor).not.toHaveBeenCalled();
  });

  it('uses a dev override without initializing any transport', async () => {
    (globalThis as Record<string, unknown>).__DEV__ = true;
    process.env.EXPO_PUBLIC_DEV_MAP_VARIANT = 'control';
    const analytics = await load();
    expect(await analytics.getMapExperimentVariant()).toBe('control');
    analytics.captureGrowthEvent('explore_viewed', {});
    expect(constructor).not.toHaveBeenCalled();
  });

  it('isolates QA storage from actual map choices', async () => {
    (globalThis as Record<string, unknown>).__DEV__ = true;
    process.env.EXPO_PUBLIC_DEV_MAP_VARIANT = 'illustrated';
    await (await load())
      .getMapStyleStorage()
      .setItem('preferred_map_type', 'satellite');
    expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      'qa:explore-map-default-v1:illustrated:preferred_map_type',
      'satellite',
    );
  });

  it('ignores dev overrides in production', async () => {
    process.env.EXPO_PUBLIC_DEV_MAP_VARIANT = 'control';
    const instance = {
      ready: jest.fn().mockResolvedValue(undefined),
      reloadFeatureFlagsAsync: jest
        .fn()
        .mockResolvedValue({ [MAP_DEFAULT_EXPERIMENT]: 'illustrated' }),
    };
    constructor.mockImplementation(() => instance as unknown as PostHog);
    expect(await (await load()).getMapExperimentVariant()).toBe('illustrated');
    expect(constructor).toHaveBeenCalledWith(
      'phc_test',
      expect.objectContaining({
        enableSessionReplay: false,
        sendFeatureFlagEvent: false,
        disableGeoip: true,
        captureAppLifecycleEvents: false,
        maxQueueSize: 200,
      }),
    );
  });

  it('bounds startup waiting even if the SDK never becomes ready', async () => {
    jest.useFakeTimers();
    constructor.mockImplementation(
      () =>
        ({ ready: () => new Promise(() => undefined) }) as unknown as PostHog,
    );
    const result = (await load()).getMapExperimentVariant();
    await jest.advanceTimersByTimeAsync(1800);
    expect(await result).toBeUndefined();
  });

  it('falls back after a flag request fails', async () => {
    constructor.mockImplementation(
      () =>
        ({
          ready: async () => undefined,
          reloadFeatureFlagsAsync: async () => {
            throw new Error('offline');
          },
        }) as unknown as PostHog,
    );
    expect(await (await load()).getMapExperimentVariant()).toBeUndefined();
  });

  it('does not let event delivery failures interrupt the app', async () => {
    constructor.mockImplementation(
      () =>
        ({
          capture: () => {
            throw new Error('queue unavailable');
          },
        }) as unknown as PostHog,
    );
    const analytics = await load();
    expect(() =>
      analytics.captureGrowthEvent('explore_viewed', {}),
    ).not.toThrow();
  });
});
