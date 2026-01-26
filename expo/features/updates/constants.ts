// Store URLs
export const IOS_STORE_URL = 'https://apps.apple.com/app/chooselife/id6503710563';
export const ANDROID_STORE_URL =
  'https://play.google.com/store/apps/details?id=com.chooselife.app';

// Timing configuration (in milliseconds)
export const CHECK_THROTTLE_MS = 60 * 60 * 1000; // 1 hour - throttle foreground checks

// Supabase config key
export const MIN_VERSION_CONFIG_KEY = 'min_app_version';

// Dev testing flags - controlled via environment variables
// These enable simulated update prompts in development builds
//
// Usage:
//   EXPO_PUBLIC_TEST_OTA=true npx expo start      # Test OTA update prompt
//   EXPO_PUBLIC_TEST_STORE=true npx expo start    # Test store update modal (blocking)
//
// Note: Don't enable both at once - store modal blocks OTA prompt
export const DEV_TEST_OTA_UPDATE =
  __DEV__ && process.env.EXPO_PUBLIC_TEST_OTA === 'true';
export const DEV_TEST_STORE_UPDATE =
  __DEV__ && process.env.EXPO_PUBLIC_TEST_STORE === 'true';
