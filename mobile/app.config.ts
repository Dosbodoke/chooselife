import 'dotenv/config';

export default {
  expo: {
    name: 'chooselife',
    slug: 'chooselife',
    scheme: 'chooselife',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './src/assets/icon.png',
    userInterfaceStyle: 'light',
    extra: {
      clerkPublishableKey: process.env.CLERK_PUBLISHABLE_KEY,
    },
    splash: {
      image: './src/assets/splash.png',
      resizeMode: 'contain',
      backgroundColor: '#ffffff',
    },
    updates: {
      fallbackToCacheTimeout: 0,
    },
    assetBundlePatterns: ['**/*'],
    ios: {
      supportsTablet: true,
    },
    android: {
      adaptiveIcon: {
        foregroundImage: './src/assets/adaptive-icon.png',
        backgroundColor: '#FFFFFF',
      },
    },
    web: {
      favicon: './src/assets/favicon.png',
    },
  },
};
