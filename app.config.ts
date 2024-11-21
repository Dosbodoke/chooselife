import { ExpoConfig, ConfigContext } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  "name": "Chooselife",
  "slug": "chooselife",
  "version": "1.0.0",
  "newArchEnabled": false,
  "orientation": "portrait",
  "icon": "./assets/images/icon.png",
  "scheme": "com.chooselife",
  "userInterfaceStyle": "automatic",
  "splash": {
    "image": "./assets/images/splash.png",
    "resizeMode": "contain",
    "backgroundColor": "#ffffff"
  },
  "assetBundlePatterns": ["**/*"],
  "ios": {
    "supportsTablet": true
  },
  "android": {
    "softwareKeyboardLayoutMode": "pan",
    "adaptiveIcon": {
      "foregroundImage": "./assets/images/adaptive_icon.png",
      "backgroundColor": "#ffffff"
    },
    "permissions": [
      "android.permission.ACCESS_COARSE_LOCATION",
      "android.permission.ACCESS_FINE_LOCATION"
    ],
    "package": "com.chooselife",
    "config": {
      "googleMaps": {
        "apiKey": "AIzaSyA3gcdtvNDyhcuv4F0_vHcJttOabyglhhU"
      }
    }
  },
  "web": {
    "bundler": "metro",
    "output": "static",
    "favicon": "./assets/images/favicon.png"
  },
  "plugins": [
    "expo-router",
    [
      "expo-location",
      {
        "locationAlwaysAndWhenInUsePermission": "Allow $(PRODUCT_NAME) to use your location."
      }
    ],
    [
      "expo-asset",
      {
        "assets": ["./assets/images/chooselife_black.png", "./assets/images/ui_dark.webp", "./assets/images/ui_light.webp"]
      }
    ]
  ],
  "experiments": {
    "typedRoutes": true
  },
  "extra": {
    "router": {
      "origin": false
    },
    "eas": {
      "projectId": "6767d806-09e4-4095-ba1f-10805e3d0c5f"
    }
  }
});
  