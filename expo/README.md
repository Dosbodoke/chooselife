# CHOOSELIFE MOBILE

A mobile app designed for highliners to track their activities, connect with others, and share their experiences.

## Table of Contents

- [Tech Stack](#tech-stack)
- [Environment Setup](#environment-setup)
  - [Supabase Configuration](#supabase-configuration)
    - [Project Setup](#project-setup)
    - [Database Setup](#database-setup)
    - [OAuth Configuration](#oauth-configuration)
    - [Connecting to Expo](#connecting-to-expo)
  - [Mapbox Configuration](#mapbox-configuration)
  - [Push Notifications](#push-notifications)
- [Running Locally](#running-locally)
- [Contributing](#contributing)
- [Authors](#authors)
- [License](#license)

## Tech Stack

**Front-end:**
* [Expo](https://expo.dev/) - React Native framework for cross-platform development.
* [NativeWind](https://www.nativewind.dev/) - Tailwind CSS for React Native.

**Back-end:**
* [Supabase](https://supabase.com/) - Open-source Firebase alternative (database, authentication, etc.).

## Environment Setup

Before setting up the project, ensure you have the following installed:

- Node.js (version 18.18.0 or higher)  
- Expo CLI (`npm install -g expo-cli`)  
- Supabase CLI (`npm install -g supabase`)  
- An Expo account  
- A Supabase account  
- A Mapbox account  

To run this project, you need to configure the following services.

### Supabase Configuration

Supabase serves as the project's backend, handling database and authentication.

1.  **Create a Supabase Project:**
    * You can either run Supabase locally with `npx supabase init` or create a cloud project at [supabase.com/dashboard/new/new-project](https://supabase.com/dashboard/new/new-project).
    * This guide focuses on cloud setup.

#### Database Setup

1.  **Link to Your Project:**
    * Use the following command, replacing `<project-id>` with your project's ID (found in the dashboard URL):
  
      ```bash
      npx supabase link --project-ref <project-id>
      ```

2.  **Push Migrations:**
    * Apply database migrations from `supabase/migrations` to your remote database:
  
      ```bash
      npx supabase db push
      ```

#### OAuth Configuration

1.  **Configure URL Redirects:**
    * In the Supabase dashboard (Auth > URL Configuration), add a Site URL matching your app's scheme (defined in `app.config.ts`).
    * Example: `com.bodok.chooselife://*`
2.  **Enable Social Auth:**
    * Enable Google and Apple social login in the Supabase dashboard.
    * Follow these guides:
        * [Setup Apple oAuth on EXPO](https://supabase.com/docs/guides/auth/social-login/auth-apple?queryGroups=platform&platform=react-native)
        * [Setup Google oAuth on EXPO](https://supabase.com/docs/guides/auth/social-login/auth-google?queryGroups=platform&platform=react-native)
    * [Use Auth locally](https://supabase.com/docs/guides/local-development/overview#use-auth-locally)

#### Connecting to Expo

1.  **Get API Keys:**
    * Find your Project URL and publishable keys in the Supabase dashboard (API Settings).
2.  **Create `.env` File:**
    * Run `cp .env.example .env` and add fill it with your Supabase credentials:

### Mapbox Configuration

1.  **Get Mapbox Keys:**
    * Obtain your public Mapbox key from your Mapbox account.
2.  **Add to `.env`:**
    * Add the public key to your `.env` file:

        ```
        EXPO_PUBLIC_MAPBOX_PUBLIC_KEY=YOUR_MAPBOX_PUBLIC_KEY
        ```
3.  **Add Download Token**
    * Create a new token with all public scopes and **DOWNLOADS:READ** Secret Scope, put it under `MAPBOX_DOWNLOAD_TOKEN` in your `.env`.

        ```
        MAPBOX_DOWNLOAD_TOKEN=YOUR_MAPBOX_DOWNLOAD_TOKEN
        ```

### Push Notifications

1.  **Expo Push Notification Setup:**
    * Follow the [Expo push notification setup guide](https://docs.expo.dev/push-notifications/push-notifications-setup/) (especially steps 3 and 4).
2.  **Supabase Integration:**
    * Integrate Supabase for backend push notifications. Refer to the [integration guide](https://supabase.com/docs/guides/functions/examples/push-notifications?queryGroups=platform&platform=expo).
3.  **Sending Notifications:**
    * Notifications can be sent via:
        * Supabase Edge Function: Deploy with `supabase functions deploy push-notification` and set up a database webhook as described in the Supabase guide.
        * `sendPushNotification` helper function within the mobile app.

## Running Locally

1.  **Install Expo EAS:**
    * Install Expo EAS: [expo.dev/eas](https://expo.dev/eas).
2.  **Create Development Build:**
    * Build a development version:
        ```bash
        npx eas build -e development
        ```
3.  **Start Development Server:**
    * Start the Expo development server:
        ```bash
        npx expo start -c
        ```
