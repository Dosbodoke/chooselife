import type { ConfigContext, ExpoConfig } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'ChooseLife',
  slug: 'chooselife',
  version: '1.3.10',
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
  newArchEnabled: true,
  orientation: 'portrait',
  scheme: 'com.bodok.chooselife',
  userInterfaceStyle: 'light',
  assetBundlePatterns: ['**/*'],
  ios: {
    bundleIdentifier: 'com.bodok.chooselife',
    usesAppleSignIn: true,
    supportsTablet: false,
    associatedDomains: ['applinks:chooselife.club'],
    infoPlist: {
      ITSAppUsesNonExemptEncryption: false,
      UIUserInterfaceStyle: 'Light',
    },
    config: {
      usesNonExemptEncryption: false,
    },
    icon: './assets/icons/ios-light.png',
  },
  android: {
    package: 'com.bodok.chooselife',
    googleServicesFile: './credentials/google-services.json',
    intentFilters: [
      {
        action: 'VIEW',
        autoVerify: true,
        data: [
          {
            scheme: 'https',
            host: 'chooselife.club',
            pathPattern: '.*highline/.*',
          },
          {
            scheme: 'https',
            host: 'chooselife.club',
            pathPattern: '.*profile/.*',
          },
        ],
        category: ['BROWSABLE', 'DEFAULT'],
      },
    ],
    softwareKeyboardLayoutMode: 'pan',
    adaptiveIcon: {
      foregroundImage: './assets/icons/adaptive-icon.png',
      monochromeImage: './assets/icons/adaptive-icon.png',
      backgroundColor: '#ffffff',
    },
    permissions: [
      'android.permission.ACCESS_COARSE_LOCATION',
      'android.permission.ACCESS_FINE_LOCATION',
    ],
  },
  web: {
    bundler: 'metro',
    output: 'static',
    favicon: './assets/icons/favicon.png',
  },
  plugins: [
    'expo-apple-authentication',
    'expo-sqlite',
    'expo-router',
    'expo-localization',
    'expo-secure-store',
    [
      'expo-notifications',
      {
        icon: './assets/icons/android-notification-icon.png',
        color: '#000000',
      },
    ],
    [
      'expo-splash-screen',
      {
        image: './assets/icons/splash-icon-dark.png',
        imageWidth: 200,
        resizeMode: 'contain',
        backgroundColor: '#FFFFFF',
        // dark: {
        //   image: "./assets/icons/splash-icon-light.png",
        //   backgroundColor: "#000000",
        // },
      },
    ],
    [
      '@rnmapbox/maps',
      {
        RNMAPBOX_MAPS_DOWNLOAD_TOKEN: process.env.MAPBOX_DOWNLOAD_TOKEN,
      },
    ],
    [
      'expo-location',
      {
        locationWhenInUsePermission:
          '$(PRODUCT_NAME) uses your location to show nearby highlines and display your position on the map while exploring locations. Your location is not stored or shared.',
      },
    ],
    [
      'expo-asset',
      {
        assets: [
          './assets/images/chooselife_black.png',
          './assets/images/default_profile_picture.jpg',
        ],
      },
    ],
    [
      '@sentry/react-native/expo',
      {
        url: 'https://sentry.io/',
        project: 'app-chooselife',
        organization: 'bodok',
      },
    ],
  ],
  extra: {
    router: {
      origin: false,
    },
    eas: {
      projectId: '6767d806-09e4-4095-ba1f-10805e3d0c5f',
    },
  },
  updates: {
    url: 'https://u.expo.dev/6767d806-09e4-4095-ba1f-10805e3d0c5f',
  },
  runtimeVersion: {
    policy: 'appVersion',
  },
});
