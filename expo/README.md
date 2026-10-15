# CHOOSELIFE MOBILE

A mobile app designed for highliners to track their activities, connect with others, and share their experiences.

## Table of Contents

- [Tech Stack](#tech-stack)
- [Environment Setup](#environment-setup)
  - [Connecting to Expo](#connecting-to-expo)
  - [Mapbox Configuration](#mapbox-configuration)
  - [Push Notifications](#push-notifications)
- [Running Locally](#running-locally)
- [Testing](#testing)
  - [Unit Tests](#unit-tests)
  - [E2E Tests with Maestro](#e2e-tests-with-maestro)
- [Deployment](#deployment)
  - [OTA Updates](#ota-updates)
  - [Store Builds](#store-builds)
  - [Forcing a Store Update](#forcing-a-store-update)
- [Contributing](#contributing)
- [Authors](#authors)
- [License](#license)

## Tech Stack

**Front-end:**

- [Expo](https://expo.dev/) - React Native framework for cross-platform development.
- [NativeWind](https://www.nativewind.dev/) - Tailwind CSS for React Native.

**Back-end:**

- [Supabase](https://supabase.com/) - Open-source Firebase alternative (database, authentication, etc.).

## Environment Setup

Before setting up the project, ensure you have the following installed:

- Node.js (version 18.18.0 or higher)
- Expo CLI (`npm install -g expo-cli`)
- An Expo account
- A Mapbox account

Also, you need to follow the [Supabase setup instructions](../supabase/README.md).

### Connecting to Expo

1.  **Get API Keys:**
    - Find your Project URL and publishable keys in the Supabase dashboard (API Settings).
2.  **Create `.env` File:**
    - Run `cp .env.example .env` and add fill it with your Supabase credentials:

### Mapbox Configuration

1.  **Get Mapbox Keys:**
    - Obtain your public Mapbox key from your Mapbox account.
2.  **Add to `.env`:**
    - Add the public key to your `.env` file:

      ```
      EXPO_PUBLIC_MAPBOX_PUBLIC_KEY=YOUR_MAPBOX_PUBLIC_KEY
      ```

3.  **Add Download Token**
    - Create a new token with all public scopes and **DOWNLOADS:READ** Secret Scope, put it under `MAPBOX_DOWNLOAD_TOKEN` in your `.env`.

      ```
      MAPBOX_DOWNLOAD_TOKEN=YOUR_MAPBOX_DOWNLOAD_TOKEN
      ```

### Push Notifications

1.  **Expo Push Notification Setup:**
    - Follow the [Expo push notification setup guide](https://docs.expo.dev/push-notifications/push-notifications-setup/) (especially steps 3 and 4).
2.  **Supabase Integration:**
    - Integrate Supabase for backend push notifications. Refer to the [integration guide](https://supabase.com/docs/guides/functions/examples/push-notifications?queryGroups=platform&platform=expo).
3.  **Sending Notifications:**
    - Notifications can be sent via:
      - Supabase Edge Function: Deploy with `supabase functions deploy push-notification` and set up a database webhook as described in the Supabase guide.
      - `sendPushNotification` helper function within the mobile app.

## Running Locally

1.  **Install Expo EAS:**
    - Install Expo EAS: [expo.dev/eas](https://expo.dev/eas).
2.  **Create Development Build:**
    - Build a development version:
      ```bash
      npx eas build -e development
      ```
3.  **Start Development Server:**
    - Start the Expo development server:
      ```bash
      pnpm dev
      ```

### App variants and blueprint icon

The [Expo app-variant pattern](https://docs.expo.dev/build-reference/variants/) uses `APP_VARIANT` to select the app identity and icon. Each EAS profile sets this explicitly. An unset value defaults to production; an unknown value fails configuration rather than silently selecting an app.

| Build profile | Variant | App identifier | Icon | Update channel |
| --- | --- | --- | --- | --- |
| `development` | development, iOS simulator | `com.bodok.chooselife.dev` | Blueprint | development |
| `development-device` | development, physical device | `com.bodok.chooselife.dev` | Blueprint | development |
| `preview` | preview, internal distribution | `com.bodok.chooselife.preview` | Blueprint | preview |
| `testflight` | preview, store distribution | `com.bodok.chooselife.preview` | Blueprint | preview |
| `production` | production, store distribution | `com.bodok.chooselife` | Existing production icon | production |

Development, preview, and production can be installed together. Internal preview and TestFlight preview share an identity, so installing one replaces the other. TestFlight preview is a release build, without a development launcher.

Run these commands from `expo/`:

```bash
# Local development server and native debug builds
pnpm dev
pnpm ios
pnpm android

# EAS builds
eas build --profile development --platform ios
eas build --profile development-device --platform ios
eas build --profile preview --platform all

# Separate preview app for TestFlight
eas build --profile testflight --platform ios
eas submit --profile testflight --platform ios

# OTA updates with matching identity, channel, and EAS environment
pnpm update:development
pnpm update:preview
pnpm update:production
```

The local scripts select development explicitly, including web and OTA/store QA modes. For direct CLI commands, set `APP_VARIANT=development` or `APP_VARIANT=preview` yourself. EAS local builds use their selected profile too, for example `eas build --profile development-device --platform ios --local`.

**Rebuild and reinstall to see the new icon.** OTA updates cannot change the installed launcher icon or application identifier. If this checkout already has generated `ios/` or `android/` directories from another variant, regenerate them before switching variants:

```bash
APP_VARIANT=development pnpm exec expo prebuild --clean
pnpm ios
```

Native directories are ignored and regenerated by Expo. Keep any manual native edits before running clean prebuild. Nonproduction runtime versions include the variant, so preview and development updates cannot target production runtimes; production keeps its existing app-version policy.

Before the first device build, register the new identifiers with the services the app uses:

- Create Apple signing/provisioning and Apple Sign In configuration for the development and preview bundle IDs. TestFlight preview needs a separate App Store Connect app for `com.bodok.chooselife.preview`; select that app during submission. Builds uploaded under the production profile still use the production icon, including in TestFlight.
- Register the development and preview Android packages with Firebase. Supply their matching files through `GOOGLE_SERVICES_JSON` in each EAS environment, or use ignored local files `credentials/google-services-development.json` and `credentials/google-services-preview.json`. Production retains `credentials/google-services.json`. Do not reuse a production-only Firebase file for the new packages.
- Register the variant URL schemes and bundle IDs with Supabase Auth, in **both** the production and stage projects:
  - Auth → URL Configuration → Redirect URLs: `com.bodok.chooselife://**`, `com.bodok.chooselife.dev://**`, and `com.bodok.chooselife.preview://**`. Use `**`: a single `*` stops at `.` and `/`. Without the variant entry, Google sign-in ends on the website (Supabase falls back to the Site URL) instead of returning to the app.
  - Auth → Providers → Apple → Client IDs: add `com.bodok.chooselife.dev,com.bodok.chooselife.preview` next to the existing IDs. Otherwise native Apple sign-in fails with `Unacceptable audience in id_token`, because the token's audience is the bundle ID.
- To support verified website links in these apps, add their identifiers and signing fingerprints to the website's Apple/Android association files.

These variants select build identity and assets, not a separate backend. Keep API and other service values in their appropriate EAS environment. Use the update scripts so `APP_VARIANT` is also present during EAS Update, which does not read build-profile `env` values. If publishing updates directly with `--environment`, configure the matching plaintext `APP_VARIANT` variable in that EAS environment as well.

The approved larger artwork is `assets/icons/blueprint.png`, a 1024 × 1024 opaque PNG. The earlier concept remains saved outside the project and all original production icons remain in place. Android's themed monochrome icon keeps the existing wordmark; the full-color icon uses the blueprint artwork.

## Testing

### Unit Tests

Run unit tests with Jest:

```bash
# Run all tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Run tests with coverage report
pnpm test:coverage

# Run tests for a specific feature
pnpm test features/updates
```

### E2E Tests with Maestro

We use [Maestro](https://maestro.mobile.dev/) for end-to-end testing. Maestro tests are located in the `.maestro/` directory.

#### Prerequisites

1. **Install Maestro:**

   ```bash
   # macOS
   brew install maestro

   # Other platforms: https://maestro.mobile.dev/getting-started/installing-maestro
   ```

2. **Development Build:**
   You need a development build installed on the simulator. The app must be able to connect to Metro bundler.

#### Running E2E Tests

E2E tests require two terminals - one running Metro bundler with test flags, and another running Maestro.

**OTA Update Tests** (non-blocking bottom sheet prompt):

```bash
# Terminal 1: Start Metro with OTA test flag
pnpm dev:test:ota

# Terminal 2: Run OTA update tests
pnpm maestro:ota
```

**Store Update Tests** (blocking full-screen modal):

```bash
# Terminal 1: Start Metro with store test flag
pnpm dev:test:store

# Terminal 2: Run store update test
pnpm maestro:store
```

> **Note:** Don't enable both test flags at once. The store update modal is blocking and will prevent OTA tests from running.

#### Available Test Scripts

| Script                | Description                                      |
| --------------------- | ------------------------------------------------ |
| `pnpm dev:test:ota`   | Start Metro with `EXPO_PUBLIC_TEST_OTA=true`     |
| `pnpm dev:test:store` | Start Metro with `EXPO_PUBLIC_TEST_STORE=true`   |
| `pnpm maestro:ota`    | Run OTA update E2E tests                         |
| `pnpm maestro:store`  | Run store update E2E test                        |
| `pnpm maestro`        | Run all Maestro tests                            |
| `pnpm maestro:studio` | Open Maestro Studio for interactive test writing |

#### Test Environment Variables

| Variable                      | Purpose                                         |
| ----------------------------- | ----------------------------------------------- |
| `EXPO_PUBLIC_TEST_OTA=true`   | Simulates an available OTA update in dev builds |
| `EXPO_PUBLIC_TEST_STORE=true` | Simulates a required store update in dev builds |

These flags only work in development builds (`__DEV__ === true`) and are ignored in production.

#### Writing New Maestro Tests

1. Use `pnpm maestro:studio` to interactively build tests
2. Place test files in `.maestro/` directory
3. Use `testID` props on components for reliable element selection
4. See existing tests in `.maestro/updates/` for examples

## Deployment

### OTA Updates

OTA (Over-The-Air) updates push JavaScript bundle changes to users without requiring a new store build. The app checks for updates on launch and when returning from the background (throttled to once per hour).

When an update is available, users see a bottom sheet prompt with two options:

- **Update Now** — downloads the update and restarts the app immediately
- **Next Time** — dismisses the prompt and downloads the update silently in the background; it applies automatically on the next app launch

To publish an OTA update:

```bash
# Publish to the production channel
pnpm update:production

# Or for a specific message
pnpm update:production --message "Fix crash on profile screen"
```

> **Note:** OTA updates can only change JavaScript/assets. Native code changes (new libraries, permission changes, etc.) require a new store build.
> With `runtimeVersion.policy = "appVersion"`, the update only reaches installed apps with the same `version` value from `app.config.ts`.

### Store Builds

For changes that require a new native binary (new SDK version, native module changes, etc.):

```bash
# Build for both platforms
eas build --profile production --platform all

# Submit to stores
eas submit --platform ios
eas submit --platform android

# Build the separate preview app for TestFlight
eas build --profile testflight --platform ios
eas submit --profile testflight --platform ios
```

After publishing a new store build, update the `version` field in `app.config.ts` to match.

#### Forcing Users to Update

The app checks a `min_app_version` config in Supabase on every launch. If the user's app version is below the minimum, a blocking modal appears directing them to update from the store.

When you ship a breaking change that requires all users to be on the latest version, bump the minimum version in Supabase:

```sql
UPDATE app_config
SET value = '{"ios": "1.4.0", "android": "1.4.0"}'
WHERE key = 'min_app_version';
```

Any user running a version below `1.4.0` will see a blocking modal and cannot use the app until they update from the store.
