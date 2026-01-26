// Define React Native globals
declare let __DEV__: boolean;
(globalThis as Record<string, unknown>).__DEV__ = true;

// Mock expo-sqlite/kv-store (AsyncStorage)
jest.mock('expo-sqlite/kv-store', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
  },
}));

// Mock expo-updates
jest.mock('expo-updates', () => ({
  __esModule: true,
  isEnabled: true,
  checkForUpdateAsync: jest.fn(),
  fetchUpdateAsync: jest.fn(),
  reloadAsync: jest.fn(),
}));

// Mock expo-in-app-updates
jest.mock('expo-in-app-updates', () => ({
  __esModule: true,
  checkForUpdate: jest.fn(),
  startUpdate: jest.fn(),
  AppUpdateType: {
    FLEXIBLE: 0,
    IMMEDIATE: 1,
  },
}));

// Mock expo-constants
jest.mock('expo-constants', () => ({
  __esModule: true,
  default: {
    expoConfig: {
      version: '1.3.14',
    },
  },
}));

// Mock expo-linking
jest.mock('expo-linking', () => ({
  __esModule: true,
  openURL: jest.fn(),
}));

// Mock supabase
jest.mock('~/lib/supabase', () => ({
  supabase: {
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          single: jest.fn(),
        })),
      })),
    })),
  },
}));

// Mock react-native
jest.mock('react-native', () => ({
  Platform: {
    OS: 'ios',
    select: jest.fn((obj: Record<string, unknown>) => obj.ios || obj.default),
  },
  AppState: {
    currentState: 'active',
    addEventListener: jest.fn(() => ({ remove: jest.fn() })),
  },
}));
