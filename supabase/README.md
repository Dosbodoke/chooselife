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
pnpm db:verify --check-types
```

This proves that the checked-in database still builds from scratch. It copies the
migrations, seeds, tests, `verification/` and `config.toml` into a new temp
directory, gives the copy its own `chooselife-verify-<id>` project ID and free
ports, and turns off Studio, analytics and Edge runtime there. Then it starts that
disposable stack and runs, in order:

1. `db reset --local`, which replays every migration and the seed files listed in
   `config.toml`.
2. A check that the applied versions match the migration files.
3. A catalog capture: `verification/catalog.sql` runs against the fresh replay,
   before lint or pgTAP can install their helpers.
4. `db lint` on `public` at error level.
5. Every pgTAP file in `supabase/tests`. The run fails if no tests run or the
   pgTAP summary can't be read.
6. With `--check-types`, type generation from the replay, compared with the
   tracked artifact. Any difference fails the run.

The catalog capture is validated by the same checker as `pnpm db:catalog:compare`
and written as `catalog.json` in the disposable project directory. A missing
query, a failed query or a malformed, truncated or incomplete result fails the
run. The verifier never prints the catalog itself: a failed query shows only its
error output.

Your own `chooselife` stack, its data and the root `config.toml` are never touched.
The verifier refuses hosted targets, drops Supabase tokens and passwords from the
CLI's environment and doesn't print keys. A run takes about a minute, longer when
Docker first pulls the images.

Without `--keep` it stops the disposable project and deletes its directory,
including `catalog.json`, also after a failure or Ctrl-C. If that cleanup fails,
it prints a `Recover with:` command for that project only. Exit codes are 0 for a
pass, 1 for a failed check or cleanup and 2 for bad arguments.

```bash
pnpm db:verify --keep
```

`--keep` leaves the disposable stack running for investigation and prints its
path, project ID, ports, cleanup command and, once captured, the `catalog` file.
Pass that file to `pnpm db:catalog:compare` to compare it with another capture.
Run the cleanup command when you're done. It stops only that project and removes
only its directory.

The `Database` GitHub Actions workflow runs the helper tests (`node --test` on
`scripts/verify-database.test.mjs`, `scripts/check-database-catalog.test.mjs` and
`scripts/supabase-gen-types.test.mjs`) and `pnpm db:verify --check-types`. Both
steps block. A failed catalog capture or any generated-type difference fails the
job. It runs on pull requests and pushes to `main` and `develop` that touch
database files, these helpers, `packages/database`, formatter configuration or a
module that imports the generated types directly. It uses no Supabase secrets and
never links, pushes or deploys.

## Database Types

`packages/database/database-generated.types.ts` is generated whole from a clean
replay of the checked-in migrations. Write it only through the helper, and
regenerate it from a disposable project:

```bash
pnpm db:verify --keep                                  # note the printed "path"
bash supabase-gen-types.sh --workdir <path>            # write the artifact
bash supabase-gen-types.sh --check --workdir <path>    # exit 0: up to date
# then run the "cleanup" command that --keep printed
```

Commit the regenerated file whole, never a spliced block. `pnpm db:verify
--check-types` and CI fail when it differs from the replay.

```bash
pnpm db:types                       # regenerate from the local chooselife stack
pnpm db:types:check                 # exit 0 if it matches, 1 if it drifted
pnpm db:types --workdir <dir> --output <file>
```

- Without `--workdir`, `pnpm db:types` reads your own `chooselife` stack. That
  database can hold objects with no checked-in migration yet, such as work in
  progress on another branch. Don't commit types generated from it: the canonical
  source is the clean replay above, and an object enters the artifact only with
  its migration.
- `--workdir` is the directory containing `supabase/config.toml`, so it selects
  whose local database to read. The default is the repository root, which is the
  `chooselife` stack and has to be running.
- `--output` defaults to the tracked artifact. Relative `--workdir` and `--output`
  paths resolve from the directory the command runs in: the repository root for
  `pnpm db:types`, `packages/database` for the package script. Absolute paths
  avoid the difference.
- Generation always uses `--local` and the `storage,public,functions` schemas.
  `--linked` and unknown options exit 2 before the CLI runs.
- The CLI output is formatted with the repository's Prettier, using the
  configuration that applies to the tracked artifact whatever `--output` is. Don't
  reformat the artifact by hand.
- The new file replaces the artifact only after it is complete and contains
  `export type Database`. A failed generation or formatting step leaves the
  artifact byte-for-byte unchanged. `--check` never writes. Exit codes are 0 for
  written or up to date, 1 for drift or a missing artifact and 2 for usage,
  generation or formatting errors.

`pnpm --filter @chooselife/database gen-types` runs the same helper.

Hand-written corrections live in `packages/database/index.ts`, which merges them
over the generated types: PostGIS POINT columns, localized notification JSON and
the optional `highline` insert `slug` that a trigger fills in. Change them there,
never in the generated file. Most app modules import the types through
`next/utils/supabase/database.types.ts` and `expo/utils/database.types.ts`, which
re-export `@chooselife/database`; `packages/ui` and some `next` modules import the
package directly. After a regeneration, typecheck `chooselife-web`,
`chooselife-mobile` and `@chooselife/ui`.

## Staging Comparison

`pnpm db:verify` checks only the local replay. To compare a hosted project, run
`verification/catalog.sql` there read-only, for example through the Supabase SQL
connector, and save the result. Then reset a `--keep` project to the hosted
project's migration version, capture it and compare:

```bash
pnpm exec supabase --workdir <path> db reset --local --version <version> --no-seed
pnpm exec supabase --workdir <path> db query --local \
  --file "$PWD/supabase/verification/catalog.sql" --output json > local.json
pnpm db:catalog:compare local.json hosted.json
```

Keep both captures out of the repository.

**Status: blocked.** The October 17, 2026 comparison of staging
(`festival-chooselife-stage`) at its recorded version `20261014162921` exited 1
with 217 named differences that the replay doesn't reproduce. That result
stands: no comparison has passed since, and the scope decision on B1 below
doesn't change it.

- **B1, legacy Storage buckets: outside the target.** Application media is
  stored in R2, not Supabase Storage. Staging's legacy bucket IDs and upload
  MIME rules differ from what the bucket migration creates, and staging has a
  public `webbings` bucket that no migration creates. By the owner's R2
  decision, bucket IDs, existence and MIME rules are not part of the desired
  state, so these differences are historical diagnostics only. Don't recreate
  the buckets or their MIME rules in a migration or desired schema. No hosted
  bucket was changed or deleted, and cleanup isn't authorized. The decision
  covers bucket configuration only; Storage grants and policies stay in scope.
- **B2, schema `public` ACL.** Staging has revoked the `PUBLIC` role's `USAGE`
  on `public`; the replay keeps the Postgres default.
- **B3, platform security state.** Staging still has pgsodium and the older
  pgsodium-based Vault, with different Vault grants, and other platform image
  and service versions with different grants and settings.

B2, B3 and the other platform security differences remain blocking. None is
accepted as a security exception, and staging does not have parity with the
replay. Staging also lags by one migration,
`20261015013845_webbing_catalog_snapshot`. That is a pending deployment, not
drift. Production was not inspected. The nonsecret detail is in
`plans/003-supabase-baseline-and-types.notes.md`.

The checker is unchanged. It still compares all 17 catalog sections, including
`storage_buckets`, so a hosted comparison still reports the B1 lines. Narrowing
the parity scope needs its own reviewed change that names exactly what it
excludes, not a broad ignore.

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

