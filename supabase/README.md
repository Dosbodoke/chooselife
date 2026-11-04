# Supabase configuration

Supabase provides the database and authentication for Chooselife. Run the commands in this guide from the repository root.

## Local database and declarative schemas

Use Node 24.18.0, pnpm 11.10.0, and Docker (Docker Desktop, OrbStack, or
Colima). Run `pnpm install --frozen-lockfile`; the repository pins Supabase CLI
2.121.0. Use `pnpm exec supabase`, since a globally installed CLI may use a
different engine or targeting convention.

The complete desired **application schema** lives in `supabase/schemas/`,
organized by schema and object. The export includes `public` and `private`
functions, tables, enum types, constraints, indexes, policies, grants, default
privileges, the signup trigger on `auth.users`, Realtime publication membership,
and named cron jobs. Supabase maintains its own platform tables. Keep the
export metadata and default-privilege overlays alongside the SQL files.

For a schema change:

1. Edit the current object definition under `supabase/schemas/`.
2. Run `pnpm db:schema:diff <descriptive_name>` to generate a migration without
   applying it. The wrapper rejects extra flags and enables strict coverage.
3. Review the generated SQL. Pay particular attention to DROP/TRUNCATE,
   drop-and-add column renames, narrowing types, table recreation, grants,
   security-definer functions, and changed cron jobs. A successful diff does
   not prove a data conversion is safe; write an explicit forward data migration
   when needed.
4. Run `pnpm db:schema:check`. It fresh-replays all migrations and seeds, verifies
   exact migration history, checks no-op sync, hashes application/auth/storage
   rows and sequence state before and after, lints SQL, runs every pgTAP file,
   and independently reconstructs the declarations on a fresh platform.
   Catalogs (including direct/effective/default permissions, RLS, managed-schema
   customizations, functions, triggers, Realtime, and cron) must match. Role
   attributes/memberships and parameter ACLs are compared separately.
   Reconstruction executes the declared SQL directly in an owned empty database,
   deferring constraints to resolve dependencies. This deliberately uses a
   different path from the diff engine: its full-baseline emitter moves enum
   columns and normalizes CHECK expressions, and omits some platform extension
   grants. Raw declarations must preserve column order and exact permissions;
   differences are not ignored to accommodate the emitter.
5. Commit both the desired SQL and the reviewed incremental migration.

`pnpm db:verify` runs just the isolated historical replay, catalog capture, lint,
and SQL tests. `--keep` retains that disposable project and prints its cleanup
command. `pnpm db:schema:check --keep` retains failure artifacts only. Neither
checker accepts a hosted target or resets the normal developer stack. CI runs
these checks without cloud credentials and performs no deployment.

To use the schema in your normal local app, run `pnpm exec supabase start`,
then `pnpm exec supabase migration up --local`. A local `db reset --local`
erases local rows; use the isolated checker for verification.

Keep every historical migration immutable. The initial adoption adds no
migration: it must be a no-op against the existing 47-file history. Ordinary
DML, historical backfills, bucket rows, festival configuration rows, and local
personas remain in migrations/seeds. The independent schema comparison omits
only `storage.buckets` row data; Storage policies and permissions remain checked.
R2 is the current application media backend.

Do not use `db diff` for declarative authoring on this engine: it reads the live
database rather than the desired files. Direct Studio/SQL-editor changes do not
update declarations. To refresh the tree deliberately, export from a verified
clean replay with `db schema declarative generate --local --strict-coverage`;
never overwrite desired files from an arbitrary developer database.

[Supabase declarative schema guide](https://supabase.com/docs/guides/local-development/declarative-database-schemas)

## Release and backup gate

Before merging this adoption PR, create a fresh production database backup and
verify a restore locally, recording the project reference, UTC time, checksums,
and verification result privately. See [the backup runbook](BACKUP.md).
Production had no physical backups or PITR at the start of this work. A local
seed database is not a production backup.

This PR does not deploy SQL, repair hosted migration history, or change hosted
configuration. The declarative export represents clean migration replay; hosted
platform versions and privileges can differ. Never apply a full generated
baseline or local platform privilege changes to an existing hosted database.
For future releases, confirm target migration history, inspect the exact pending
migration list and SQL, take and verify the backup, then use the established
release process to deploy reviewed forward migrations only.

`[experimental.webhooks]` supports replay of historical pg_net calls in the
shadow database. Do not run `supabase config push` with this local config: it
can also change hosted webhook and Auth settings.

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

There is no automatic settlement and no provider webhook. Recurring
obligations are materialized by the `membership-billing-generate-obligations`
pg_cron job, which calls `generate_membership_billing_obligations()` hourly. It
creates every period whose availability date has arrived since admission, once,
and sends no notification. To inspect a run, query `cron.job_run_details`; to
see per-schedule failures, call `generate_membership_billing_obligations()` as
the database owner and read the rows whose `result` is `failed`. Calling it by
hand is safe: it only creates periods that are missing.

Association admins can send one person a push reminder about an open payment
from the admin billing workspace. `send_membership_payment_reminder(...)`
inserts a targeted row into `notifications`, and the existing database webhook
delivers it through the `push-notification` Edge Function. It refuses
broadcasts, people with nothing due or no registered device, and a repeat
within 20 hours.

Environments without an existing notifications webhook use the private push
dispatcher. Configure `project_url` and the legacy JWT `service_role_key` in
Supabase Vault for that environment. The dispatcher reads them at runtime and
keeps credentials out of trigger arguments. Local databases without those
settings skip external delivery. Existing dashboard webhooks are preserved.

Admins can waive selected overdue recurring contributions of one person with
`waive_recurring_contributions(organization_id, user_id, obligation_ids, reason)`.
The command accepts up to 60 distinct contributions and a reason of 1 to 500
characters. It rejects settled charges, admission payments, charges not yet
overdue, and payments under review. A batch succeeds in full or changes nothing.
Admins may waive their own arrears; the audit records the acting admin.

A waived contribution becomes `void`, retains its original amount, and has an
immutable record in `payment_obligation_waivers`. It is no longer payable and
never counts as paid. Its schedule-period row stays in place so generation
cannot recreate the debt. Future contributions continue normally. There is no
undo command. The admin workspace reads the audit through
`get_billing_workspace_waivers(organization_id)`; clients cannot access the audit
table directly. These authenticated RPCs use `SECURITY DEFINER` intentionally
and check association-admin permissions before returning data or making changes.

## Cron Jobs Secrets

Some migrations schedule cron jobs that require secrets to run. You need to [set them up in the Supabase Vault](https://supabase.com/docs/guides/database/vault).
You can do this by settling it up trough the dashboard or by running the following commands in the Supabase SQL Editor.

Replace the placeholder values with your actual project reference and service role key.

```sql
-- Run this in your Supabase SQL Editor:
select vault.create_secret('https://<your-project-ref>.supabase.co', 'project_url', 'URL for the Supabase project');
select vault.create_secret('<your-secret-key>', 'secret_key', 'Supabase Secret key');
```

The old `daily-renewal-check` job is removed by the retained billing
reconciliation migration. The current declared jobs are the three festival jobs
and `membership-billing-generate-obligations`; preserve their definitions when
reviewing generated migrations.

## OAuth Configuration

1.  **Configure URL Redirects:**
    - In the Supabase dashboard (Auth > URL Configuration), add every app scheme from `expo/app.config.ts` to **Redirect URLs** (not the Site URL). Each app variant has its own scheme:
      - `com.bodok.chooselife://**` (production)
      - `com.bodok.chooselife.dev://**` (development builds)
      - `com.bodok.chooselife.preview://**` (preview builds)
    - Use `**`; a single `*` does not match `.` or `/`. A redirect URL that is not listed falls back to the Site URL, so the OAuth sheet opens the website instead of returning to the app.
    - This is a dashboard setting for the production and stage projects. `supabase/config.toml` only configures the local stack; do not `supabase config push` it to a remote project.
2.  **Enable Social Auth:**
    - Enable Google and Apple social login in the Supabase dashboard.
    - Apple's **Client IDs** must list every bundle ID that signs in natively: `com.bodok.chooselife`, `com.bodok.chooselife.dev`, and `com.bodok.chooselife.preview`.
    - Follow these guides:
      - [Setup Apple oAuth on EXPO](https://supabase.com/docs/guides/auth/social-login/auth-apple?queryGroups=platform&platform=react-native)
      - [Setup Google oAuth on EXPO](https://supabase.com/docs/guides/auth/social-login/auth-google?queryGroups=platform&platform=react-native)
    - [Use Auth locally](https://supabase.com/docs/guides/local-development/overview#use-auth-locally)
