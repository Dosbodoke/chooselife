# Supabase configuration

Supabase provides the database and authentication for Chooselife. Run the commands in this guide from the repository root.

First of all, install the CLI

- Supabase CLI (`npm install -g supabase`)

1.  **Create a Supabase Project:**
    - You can either run Supabase locally with `npx supabase init` or create a cloud project at [supabase.com/dashboard/new/new-project](https://supabase.com/dashboard/new/new-project).
    - This guide focuses on cloud setup.

## Database Setup

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

## Deploying Edge Functions

Use the provided deployment script instead of running `supabase functions deploy` manually. There are two deployable functions, `push-notification` and `user-self-deletion`. There is no payment gateway: association contributions are manual PIX obligations that an association admin verifies by hand, so no Edge Function is involved in taking a payment.

- **Deploy all functions:**
  ```bash
  npm run deploy:functions
  ```

## Manual PIX Configuration

Configure the fixed PIX details on the association record in the database,
alongside the plan prices:

```sql
update public.organizations
set
  monthly_price_amount = 3500,
  monthly_pix_copy_paste = '<monthly-fixed-pix-copy-and-paste-code>',
  annual_price_amount = 36000,
  annual_pix_copy_paste = '<annual-fixed-pix-copy-and-paste-code>'
where slug = 'slac';
```

The payload is fixed per plan and is not generated per payment request.

## The Obligation and Claim Flow

Association billing has one model. Every amount a person owes is a **payment
obligation**; the app never invents a payment, it opens the obligation the
database already created.

1.  Submitting an association application through
    `submit_association_application(...)` writes one immutable revision and
    opens the `initial_admission` obligation for the first contribution.
2.  The app shows that obligation's fixed PIX QR code, read with
    `get_payment_obligation_instructions(obligation_id)` by the signed-in owner.
3.  After paying, the person files a **claim** — `claim_initial_payment(...)` for
    admission, `claim_recurring_payment(...)` for a later contribution — stating
    who made the transfer. The obligation moves to `under_review`.
4.  An association admin verifies the PIX by hand in the admin billing
    workspace. There are exactly two decisions, and both are atomic:

    - `approve_initial_claim(claim_id)` settles the obligation, admits the
      applicant, and opens the contribution schedule with its plan snapshot.
    - `reject_initial_claim(claim_id, reason)` is the single refusal command. It
      refuses the application, rejects the claim, voids the obligation and
      stores one required user-visible reason. Nothing is deleted: a correction
      is a brand new application, revision and obligation.

Recurring contributions use the matching
`approve_recurring_payment_claim` / `reject_recurring_payment_claim` pair.
Nonpayment never ends or suspends a membership — each missed contribution stays
a distinct owed obligation until an admin settles or voids it.

There is no automatic settlement, no provider webhook, and no renewal job.

## Cron Jobs Secrets

Some migrations schedule cron jobs that require secrets to run. You need to [set them up in the Supabase Vault](https://supabase.com/docs/guides/database/vault).
You can do this by settling it up trough the dashboard or by running the following commands in the Supabase SQL Editor.

Replace the placeholder values with your actual project reference and service role key.

```sql
-- Run this in your Supabase SQL Editor:
select vault.create_secret('https://<your-project-ref>.supabase.co', 'project_url', 'URL for the Supabase project');
select vault.create_secret('<your-secret-key>', 'secret_key', 'Supabase Secret key');
```

> **Known loose end.** `20251113121601_schedule-payment.sql` scheduled a
> `daily-renewal-check` cron job that POSTs to
> `/functions/v1/generate-renewal-payments`. That function no longer exists —
> there are no automatic renewal payments. On any project where the job is
> still registered it now calls a missing endpoint once a day. Unscheduling it
> needs a migration:
>
> ```sql
> select cron.unschedule('daily-renewal-check');
> ```

## OAuth Configuration

1.  **Configure URL Redirects:**
    - In the Supabase dashboard (Auth > URL Configuration), add a Site URL matching your app's scheme (defined in `app.config.ts`).
    - Example: `com.bodok.chooselife://*`
2.  **Enable Social Auth:**
    - Enable Google and Apple social login in the Supabase dashboard.
    - Follow these guides:
      - [Setup Apple oAuth on EXPO](https://supabase.com/docs/guides/auth/social-login/auth-apple?queryGroups=platform&platform=react-native)
      - [Setup Google oAuth on EXPO](https://supabase.com/docs/guides/auth/social-login/auth-google?queryGroups=platform&platform=react-native)
    - [Use Auth locally](https://supabase.com/docs/guides/local-development/overview#use-auth-locally)

