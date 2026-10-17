# Supabase configuration

Supabase provides the database and authentication for Chooselife. Run the commands in this guide from the repository root.

## Tooling

The Supabase CLI is pinned to an exact version in `packages/database/package.json`
and installed with the rest of the workspace. Run it with `pnpm exec supabase`
rather than a global `supabase` or `npx supabase`, which can be a different release.

```bash
pnpm install
pnpm exec supabase --version   # prints the pinned version
```

The local stack, `pnpm db:verify` and type generation need Node from `.nvmrc`,
pnpm from `packageManager` and a running Docker-compatible runtime such as Docker
Desktop, OrbStack or Colima.

The project is already initialized in `supabase/`. `pnpm exec supabase start`
runs the developer stack named `chooselife` on the ports in `config.toml`.

## Local Verification

```bash
pnpm db:verify
```

This proves that the checked-in database still builds from scratch. It copies the
migrations, seeds, tests and `config.toml` into a new temp directory, gives the copy
its own `chooselife-verify-<id>` project ID and free ports, and turns off Studio,
analytics and Edge runtime there. Then it starts that disposable stack, runs
`db reset --local` to replay every migration and the seed files listed in
`config.toml`, checks that the
applied versions match the migration files, runs `db lint` on `public` at error
level and runs every pgTAP file in `supabase/tests`. The run fails if no tests
run or the pgTAP summary can't be read.

Your own `chooselife` stack, its data and the root `config.toml` are never touched.
The verifier refuses hosted targets, drops Supabase tokens and passwords from the
CLI's environment and doesn't print keys. A run takes about a minute, longer when
Docker first pulls the images.

Without `--keep` it stops the disposable project and deletes its directory, also
after a failure or Ctrl-C. If that cleanup fails, it prints a `Recover with:`
command for that project only. Exit codes are 0 for a pass, 1 for a failed check
or cleanup and 2 for bad arguments.

```bash
pnpm db:verify --keep
```

`--keep` leaves the disposable stack running for investigation and prints its
path, project ID, ports and cleanup command. Run that command when you're done.
It stops only that project and removes only its directory.

The `Database` GitHub Actions workflow runs the helper tests
(`node --test scripts/verify-database.test.mjs`) and `pnpm db:verify` on pull
requests and pushes to `main` and `develop` that touch database files. It uses
no Supabase secrets and never links, pushes or deploys.

## Database Types

`packages/database/database-generated.types.ts` is generated from a local database.
Write it only through the helper:

```bash
pnpm db:types                       # regenerate from the local chooselife stack
pnpm db:types:check                 # exit 0 if it matches, 1 if it drifted
pnpm db:types --workdir <dir> --output <file>
```

- `--workdir` is the directory containing `supabase/config.toml`, so it selects
  whose local database to read. The default is the repository root, which is the
  `chooselife` stack and has to be running. Point it at a `--keep` path to read the
  disposable stack.
- `--output` defaults to the tracked artifact. Relative `--workdir` and `--output`
  paths resolve from the directory the command runs in: the repository root for
  `pnpm db:types`, `packages/database` for the package script. Absolute paths
  avoid the difference.
- Generation always uses `--local` and the `storage,public,functions` schemas.
  `--linked` and unknown options exit 2 before the CLI runs.
- The new file replaces the artifact only after it is complete and contains
  `export type Database`. Failed generation leaves the artifact byte-for-byte
  unchanged. `--check` never writes. Exit codes are 0 for written or up to date,
  1 for drift or a missing artifact and 2 for usage or generation errors.

`pnpm --filter @chooselife/database gen-types` runs the same helper.

**Known drift.** The tracked artifact doesn't match what the pinned CLI generates
today, and the CLI's output is unformatted. `pnpm db:types:check` and
`pnpm db:verify --check-types` fail until Plan 003 regenerates the artifact,
settles its formatting and makes type parity a CI gate. Until then CI doesn't
check types. Don't commit a partial regeneration. The hand-written overrides in
`packages/database/index.ts` stay as they are.

## Database Setup

This section is for a hosted project. Nothing in local verification or CI does it.

1.  **Create a Supabase Project** at [supabase.com/dashboard/new/new-project](https://supabase.com/dashboard/new/new-project).

2.  **Link to Your Project:**
    - Use the following command, replacing `<project-id>` with your project's ID (found in the dashboard URL):

      ```bash
      pnpm exec supabase link --project-ref <project-id>
      ```

3.  **Push Migrations:**
    - Apply database migrations from `supabase/migrations` to your remote database:

      ```bash
      pnpm exec supabase db push
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

