import { ConfigContext, ExpoConfig } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'ChooseLife',
  slug: 'chooselife',
  version: '1.0.0',
  newArchEnabled: true,
  orientation: 'portrait',
  scheme: 'com.bodok.chooselife',
  userInterfaceStyle: 'automatic',
  assetBundlePatterns: ['**/*'],
  ios: {
    supportsTablet: true,
    icon: {
      light: './assets/icons/ios-light.png',
      dark: './assets/icons/ios-dark.png',
      tinted: './assets/icons/ios-tinted.png',
    }
  },
  android: {
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
    package: 'com.bodok.chooselife',
  },
  web: {
    bundler: 'metro',
    output: 'static',
    favicon: './assets/icons/favicon.png',
  },
  plugins: [
    'expo-router',
    'expo-localization',
    [
      "expo-splash-screen",
      {
        image: './assets/icons/splash-icon-dark.png',
        imageWidth: 200,
        resizeMode: "contain",
        backgroundColor: "#FFFFFF",
        dark: {
          image: './assets/icons/splash-icon-light.png',
          backgroundColor: "#000000",
        }
      }
    ],
    [
      "@rnmapbox/maps",
      {
        "RNMapboxMapsDownloadToken": process.env.MAPBOX_DOWNLOAD_TOKEN 
      }
    ],
    [
      'expo-location',
      {
        locationAlwaysAndWhenInUsePermission:
          'Allow $(PRODUCT_NAME) to use your location.',
      },
    ],
    [
      'expo-asset',
      {
        assets: [
          './assets/images/chooselife_black.png',
          './assets/images/ui_dark.webp',
          './assets/images/ui_light.webp',
        ],
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
  },
  extra: {
    router: {
      origin: false,
    },
    eas: {
      projectId: '6767d806-09e4-4095-ba1f-10805e3d0c5f',
    },
  },
});
