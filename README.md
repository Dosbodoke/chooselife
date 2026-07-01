# Chooselife

Mobile and WEB apps made **for Highliners**

<a href="https://apps.apple.com/br/app/choose-life-highline/id6745024708">
	<img src="https://developer.apple.com/assets/elements/badges/download-on-the-app-store.svg" width="200"/>
</a>

<a href="https://play.google.com/store/apps/details?id=com.bodok.chooselife&hl=pt_BR">
	<img src="https://play.google.com/intl/en_us/badges/static/images/badges/en_badge_web_generic.png" width="200"/>
</a>

## Project structure

```bash
.
├── expo # Mobile app, most of the development is going her
├── next # Web app where all started
├── supabase # Local supabase instance
├── packages # Shared packages between projects
```

For informations on how to run each project check their respectives `README.md`

## Environment Setup

These instructions cover the setup for the Supabase backend. After setting up Supabase, follow the instructions to setup the clients

- 📱 expo in the `expo/README.md`
- 🌐 NextJS in the `next/README.md`

### Supabase Configuration

First of all, install the CLI

- Supabase CLI (`npm install -g supabase`)

Supabase serves as the project's backend, handling database and authentication.

1.  **Create a Supabase Project:**
    - You can either run Supabase locally with `npx supabase init` or create a cloud project at [supabase.com/dashboard/new/new-project](https://supabase.com/dashboard/new/new-project).
    - This guide focuses on cloud setup.

#### Database Setup

1.  **Link to Your Project:**
    - Use the following command, replacing `<project-id>` with your project's ID (found in the dashboard URL):

      ```bash
      npx supabase link --project-ref <project-id>
      ```

2.  **Push Migrations:**
    - Apply database migrations from `supabase/migrations` to your remote database:

      ```bash
      npx supabase db push
      ```

#### Deploying Edge Functions

Use the provided deployment script instead of running `supabase functions deploy` manually. It deploys app-invoked functions like `create-payment-checkout` with JWT verification, while intentionally deploying the external `stripe-webhook` without JWT verification so provider callbacks can reach it.

- **Deploy all functions:**
  ```bash
  npm run deploy:functions
  ```

- **Stripe secrets required on each Supabase project:**
  ```bash
  npx supabase secrets set STRIPE_SECRET_KEY=<sk_test_or_live_...>
  npx supabase secrets set STRIPE_WEBHOOK_SECRET=<whsec_...>
  ```

- **Stripe webhook endpoint:**
  `https://<project-ref>.supabase.co/functions/v1/stripe-webhook`

  Configure it in Stripe for `checkout.session.completed` and `checkout.session.expired` events.

#### Cron Jobs Secrets

Some migrations schedule cron jobs that require secrets to run. You need to [set them up in the Supabase Vault](https://supabase.com/docs/guides/database/vault).
You can do this by settling it up trough the dashboard or by running the following commands in the Supabase SQL Editor.

Replace the placeholder values with your actual project reference and service role key.

```sql
-- Run this in your Supabase SQL Editor:
select vault.create_secret('https://<your-project-ref>.supabase.co', 'project_url', 'URL for the Supabase project');
select vault.create_secret('<your-secret-key>', 'secret_key', 'Supabase Secret key');
```

#### OAuth Configuration

1.  **Configure URL Redirects:**
    - In the Supabase dashboard (Auth > URL Configuration), add a Site URL matching your app's scheme (defined in `app.config.ts`).
    - Example: `com.bodok.chooselife://*`
2.  **Enable Social Auth:**
    - Enable Google and Apple social login in the Supabase dashboard.
    - Follow these guides:
      - [Setup Apple oAuth on EXPO](https://supabase.com/docs/guides/auth/social-login/auth-apple?queryGroups=platform&platform=react-native)
      - [Setup Google oAuth on EXPO](https://supabase.com/docs/guides/auth/social-login/auth-google?queryGroups=platform&platform=react-native)
    - [Use Auth locally](https://supabase.com/docs/guides/local-development/overview#use-auth-locally)

## Contributing

1.  Fork the repository.
2.  Create a new branch for your feature or bug fix.
3.  Commit your changes.
4.  Push to your branch.
5.  Open a pull request.

## Authors

- [@Dosbodoke](https://www.github.com/Dosbodoke)
