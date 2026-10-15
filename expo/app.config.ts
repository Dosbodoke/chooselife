import type { ConfigContext, ExpoConfig } from "expo/config";

// Keep production as the safe default for direct Expo/EAS commands.
// Local scripts and EAS profiles select their variant explicitly.
const appVariant = process.env.APP_VARIANT ?? "production";
if (!["development", "preview", "production"].includes(appVariant)) {
  throw new Error(`Invalid APP_VARIANT: ${appVariant}`);
}
const isDevelopment = appVariant === "development";
const isProduction = appVariant === "production";
const version = "1.9.5";
const applicationId = isProduction
  ? "com.bodok.chooselife"
  : `com.bodok.chooselife.${isDevelopment ? "dev" : "preview"}`;
const blueprintIcon = "./assets/icons/blueprint.png";
const googleServicesFile =
  process.env.GOOGLE_SERVICES_JSON ??
  (isProduction
    ? "./credentials/google-services.json"
    : `./credentials/google-services-${appVariant}.json`);

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: isProduction
    ? "ChooseLife"
    : `ChooseLife (${isDevelopment ? "Dev" : "Preview"})`,
  slug: "chooselife",
  version,
  ...(!isProduction && { icon: blueprintIcon }),
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
  orientation: "portrait",
  scheme: applicationId,
  userInterfaceStyle: "light",
  assetBundlePatterns: ["**/*"],
  ios: {
    bundleIdentifier: applicationId,
    usesAppleSignIn: true,
    supportsTablet: false,
    associatedDomains: ["applinks:chooselife.club"],
    infoPlist: {
      ITSAppUsesNonExemptEncryption: false,
      UIUserInterfaceStyle: "Light",
    },
    config: {
      usesNonExemptEncryption: false,
    },
    icon: isProduction ? "./assets/icons/ios-light.png" : blueprintIcon,
  },
  android: {
    package: applicationId,
    googleServicesFile,
    blockedPermissions: [
      "android.permission.READ_EXTERNAL_STORAGE",
      "android.permission.WRITE_EXTERNAL_STORAGE",
      "android.permission.DOWNLOAD_WITHOUT_NOTIFICATION",
    ],
    intentFilters: [
      {
        action: "VIEW",
        autoVerify: true,
        data: [
          {
            scheme: "https",
            host: "chooselife.club",
            pathPattern: "/.*highline/.*",
          },
          {
            scheme: "https",
            host: "chooselife.club",
            pathPattern: "/.*profile/.*",
          },
          {
            scheme: "https",
            host: "chooselife.club",
            pathPattern: "/.*news/.*",
          },
          {
            scheme: "https",
            host: "chooselife.club",
            pathPattern: "/.*festival/.*",
          },
        ],
        category: ["BROWSABLE", "DEFAULT"],
      },
    ],
    softwareKeyboardLayoutMode: "pan",
    adaptiveIcon: {
      foregroundImage: isProduction
        ? "./assets/icons/adaptive-icon.png"
        : blueprintIcon,
      monochromeImage: "./assets/icons/adaptive-icon.png",
      backgroundColor: isProduction ? "#ffffff" : "#0066ff",
    },
    permissions: [
      "android.permission.ACCESS_COARSE_LOCATION",
      "android.permission.ACCESS_FINE_LOCATION",
    ],
  },
  web: {
    bundler: "metro",
    output: "static",
    favicon: isProduction ? "./assets/icons/favicon.png" : blueprintIcon,
  },
  plugins: [
    ["expo-dev-client", { addGeneratedScheme: isDevelopment }],
    [
      "expo-build-properties",
      {
        android: {
          // Skia 3 Graphite requires Android API 26 or newer.
          minSdkVersion: 26,
        },
      },
    ],
    "expo-status-bar",
    "expo-image",
    "expo-sharing",
    "./plugins/with-map-app-queries.cjs",
    "expo-apple-authentication",
    "expo-sqlite",
    "expo-router",
    "expo-localization",
    "expo-secure-store",
    "@config-plugins/react-native-blob-util",
    "@config-plugins/react-native-pdf",
    [
      "expo-notifications",
      {
        icon: "./assets/icons/android-notification-icon.png",
        color: "#000000",
      },
    ],
    [
      "expo-splash-screen",
      {
        image: "./assets/icons/splash-icon-dark.png",
        imageWidth: 200,
        resizeMode: "contain",
        backgroundColor: "#FFFFFF",
        // dark: {
        //   image: "./assets/icons/splash-icon-light.png",
        //   backgroundColor: "#000000",
        // },
      },
    ],
    [
      "@rnmapbox/maps",
      {
        RNMAPBOX_MAPS_DOWNLOAD_TOKEN: process.env.MAPBOX_DOWNLOAD_TOKEN,
      },
    ],
    [
      "expo-location",
      {
        locationWhenInUsePermission:
          "$(PRODUCT_NAME) uses your location to show nearby highlines and display your position on the map while exploring locations. Your location is not stored or shared.",
      },
    ],
    [
      "expo-asset",
      {
        assets: [
          "./assets/images/chooselife_black.png",
          "./assets/images/default_profile_picture.jpg",
        ],
      },
    ],
    [
      "@sentry/react-native/expo",
      {
        url: "https://sentry.io/",
        project: "app-chooselife",
        organization: "bodok",
      },
    ],
  ],
  extra: {
    router: {
      origin: false,
    },
    eas: {
      projectId: "6767d806-09e4-4095-ba1f-10805e3d0c5f",
    },
  },
  updates: {
    url: "https://u.expo.dev/6767d806-09e4-4095-ba1f-10805e3d0c5f",
    checkAutomatically: "ON_ERROR_RECOVERY",
  },
  runtimeVersion: isProduction
    ? { policy: "appVersion" }
    : `${version}-${appVariant}`,
});
