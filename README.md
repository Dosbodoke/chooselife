# CHOOSELIFE

Mobile app for Highliners

## Stack utilizada

**Front-end:** Expo, NativeWind

**Back-end:** Supabase

## Environment setup

In order to run this project, you need to configure several services.

### Supabase

Supabase is used as the backend of the project, including **database** and **authentication**.

#### Create a project

Since supabase can be self-hosted, you can run it locally with `npx supabase init` or [create a new cloud supabase project](https://supabase.com/dashboard/new/new-project)

But the tutorial will aim a cloud setup.

#### Configure database

All the migrations necessary to setup the database lives under `supabase/migrations`

In order to setup the remote database you need to

- Link to the project you just created

```
npx supabase link --project-ref <project-id>
```

You can get `<project-id>` from your project's dashboard URL: `https://supabase.com/dashboard/project/<project-id>`

- Push the local migrations to the remote database

```
npx supabase db push
```

#### Configure oAuth

On the Supabase dashboard, go to auth > URL Configuration and add a Site URL so the auth methods can redirect back to the project, it should match the specified `scheme` in your `app.config.ts`

On my case, it was `com.bodok.chooselife://*`

You also need to **enable Google and Apple social auth**

Follow these guides:

[Setup Apple oAuth on EXPO](https://supabase.com/docs/guides/auth/social-login/auth-apple?queryGroups=platform&platform=react-native)

[Setup Google oAuth on EXPO](https://supabase.com/docs/guides/auth/social-login/auth-google?queryGroups=platform&platform=react-native)

Aditionally, you can [Use Auth locally](https://supabase.com/docs/guides/local-development/overview#use-auth-locally)

#### Connect it with the EXPO Project

Go to the API Settings page in the Dashboard.
Find your Project URL and anon keys on this page.

Create a `.env` file at the root of the project and fill up the following credentials

```
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_ANON_KEY=
```

### Mapbox KEY's

Get the public key from your MAPBOX account

Put it under `EXPO_PUBLIC_MAPBOX_PUBLIC_KEY` on your `.env`

Also, you should create a new token with all public scopes and **DOWNLOADS:READ** Secret Scope, put it under `MAPBOX_DOWNLOAD_TOKEN` in your `.env`. Not setting it will cause the build to fail.

### Push Notifications

... under development

## Running locally

First you will need to [install Expo EAS ](https://expo.dev/eas) and create a development build with

```bash
  npx eas build -e development
```

Then start the development server with

```bash
  npx expo start -c
```

## Autores

- [@Dosbodoke](https://www.github.com/Dosbodoke)
