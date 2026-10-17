# Plan 003 execution notes

Worktree `/Users/juangsandrade/.t3/worktrees/chooselife/t3-f4bb91a0`, branch `t3/supabase-schema-workflow`. Each numbered step gets a separate review before the next one starts.

| Commit | Meaning |
| --- | --- |
| `abd5a18` | Plan 002 accepted. Implementation base for Step 1 |
| Commit that adds this file | Step 1: clean migration and compiler baseline, notes only |

Commands ran under Node 24.18.0 from nvm (`export PATH="$HOME/.nvm/versions/node/v24.18.0/bin:$PATH"`), pnpm 11.10.0, repository Supabase CLI 2.121.0, Docker 29.8.2 and TypeScript 7.0.2 in all three consumer packages. `427007b` is an ancestor of `HEAD`.

## Step 1: clean migration baseline and compiler baseline

Status: done locally, waiting for review. No tracked source, generated type, SQL, config, workflow or dependency changed. Only this notes file was added.

Private evidence lives outside the repository in `/var/folders/4d/px4017t53z7dx66qvy4fcvx00000gn/T/chooselife-003-1-private.Uy3TPs` (mode 700). It holds the before/after Docker snapshots, helper test output, the `db:verify --keep` stdout/stderr, the inventory query results under `inv/` and the full compiler output under `tsc-before/`. A pattern scan for `sb_secret_`, `sb_publishable_`, JWTs and URL passwords found nothing in it.

### Prerequisite contract

| Command | Result |
| --- | --- |
| `git status --short` | clean |
| `git diff --stat 427007b..HEAD -- packages/database supabase-gen-types.sh scripts .github/workflows/database.yml next/app/api/courses/highline-beginner/access/route.ts supabase/migrations supabase/config.toml` | Only Plan 002 files: `.github/workflows/database.yml`, `packages/database/package.json`, `scripts/verify-database.mjs`, `scripts/verify-database.test.mjs`, `supabase-gen-types.sh`. No route, migration, config or generated-type change |
| `pnpm exec supabase --workdir . --version` | `2.121.0`, exit 0 |
| `node --test scripts/verify-database.test.mjs` | exit 0, 39 tests, 39 pass |
| `ls supabase/migrations \| wc -l` | 41 |
| `rg -n profile_isa_accounts supabase/migrations` | no match, exit 1. `rg -ln profile_isa supabase/` also has no match |
| `packages/database/database-generated.types.ts` | 3407 lines, sha256 `40efe65c104497a7e6504a6e8373757f84d57180b6bab80c1f70a7ce39aabaa1`, unchanged from Plan 002 |

### Developer stack snapshot

The method matches Plan 002 Step 3. I read only `docker ps -a` ID, name, status and image; `docker inspect --format '{{.Name}} {{.Id}} {{.State.StartedAt}} {{.RestartCount}}'`; volume and network names; and `select version || ' ' || coalesce(name,'') from supabase_migrations.schema_migrations order by version` through `docker exec supabase_db_chooselife psql`. No environment, full inspect or connection data was read.

Before: 12 `supabase_*_chooselife` containers, up 13 hours, Postgres image `15.8.1.044`. Volumes: `supabase_db_chooselife`, `supabase_edge_runtime_chooselife`, `supabase_storage_chooselife` and one unrelated volume. Networks: `supabase_network_chooselife`, the defaults and one unrelated network. History: 41 rows, last `20261015013845 webbing_catalog_snapshot`, sha256 `2b6d8c0397a6d7209a7a854787f87a64505532073e95aeb2841c5510dba6f027`, the same as Plan 002. No `chooselife-verify` container, volume, network or temp directory existed.

After all Step 1 work, with this step's owned resources filtered out: `docker ps` output is identical after normalizing the hour count. Container name, ID, `StartedAt` and `RestartCount` are byte-identical. Volume names, network names and the history dump are byte-identical. The developer stack was neither stopped, restarted nor replaced.

### `pnpm db:verify --keep`

Exit 0, 02:47:52–02:48:56 UTC. Stderr held only pnpm's `$ node scripts/verify-database.mjs --keep` echo.

```text
Preparing disposable project: ok (chooselife-verify-049997ac2680, 41 migrations, 12 test files)
Starting disposable stack: ok
Replaying migrations and seeds: ok
Comparing applied migrations: ok (41 versions match 41 files)
Linting public schema: ok
Running pgTAP tests: ok (12 files, 371 assertions)
Verification passed.
```

Retained descriptor, with no credentials:

```json
{
  "path": "/private/var/folders/4d/px4017t53z7dx66qvy4fcvx00000gn/T/chooselife-verify-QD2JDJ",
  "projectId": "chooselife-verify-049997ac2680",
  "ports": {
    "api.port": 55570,
    "db.port": 55571,
    "db.shadow_port": 55572,
    "db.pooler.port": 55573,
    "studio.port": 55574,
    "inbucket.port": 55575,
    "edge_runtime.inspector_port": 55576,
    "analytics.port": 55577
  },
  "cleanup": "'/Users/juangsandrade/.t3/worktrees/chooselife/t3-f4bb91a0/node_modules/.bin/supabase' --workdir '/private/var/folders/4d/px4017t53z7dx66qvy4fcvx00000gn/T/chooselife-verify-QD2JDJ' stop --project-id chooselife-verify-049997ac2680 --no-backup && rm -rf '/private/var/folders/4d/px4017t53z7dx66qvy4fcvx00000gn/T/chooselife-verify-QD2JDJ'"
}
```

Use `DB_VERIFY_WORKDIR=/private/var/folders/4d/px4017t53z7dx66qvy4fcvx00000gn/T/chooselife-verify-QD2JDJ` for later steps. Ownership was checked against the verifier's own rules before any query. The path is absolute and a direct child of `realpath(os.tmpdir())`. Its name matches `chooselife-verify-XXXXXX`. It is a real directory, not a link, and is owned by the current uid. The project ID matches `chooselife-verify-<12 hex>`, and the copied `supabase/config.toml` carries that `project_id`. Later steps must repeat this check before each reset.

The workdir holds `config.toml`, `migrations`, `seed.sql`, `seeds` and `tests`, plus the CLI's own `.branches/_current_branch` and `.temp/cli-latest`. There is no `.temp/project-ref`. Owned resources while kept: seven containers, `supabase_{auth,db,inbucket,kong,realtime,rest,storage}_chooselife-verify-049997ac2680`. Volumes: `supabase_db_…` and `supabase_storage_…`. Network: `supabase_network_…`. The DB image is `public.ecr.aws/supabase/postgres:15.19.0.004`.

The stack is intentionally still running for Step 2 and Step 3. It has not been cleaned up.

### Pinned query interface

`node_modules/.bin/supabase --agent no db query --help` on 2.121.0 shows `db query [flags] [<sql>]` with `--local`, `--linked`, `--db-url`, `--project-ref` and `--file/-f`. Global flags include `--workdir` (used exactly as given), `--output/-o` (`env|pretty|json|toml|yaml|table|csv`), `--output-format` and `--agent auto|yes|no`.

Every inventory query used `node_modules/.bin/supabase --workdir "$DB_VERIFY_WORKDIR" --agent no db query --local --output json "<select>"`. Stdout was a JSON array of row objects, and stderr held only `Connecting to local database...`. All seven queries exited 0. Each was a single `SELECT` on `pg_catalog` or `supabase_migrations`. No function body, trigger argument, table row, user data or secret was selected.

### Migration inventory

Applied versions from `supabase_migrations.schema_migrations` equal the 41 checked-in filename prefixes in order, from `20250206202200` to `20261015013845`. The canonical `version name` list has sha256 `2b6d8c03…f027`, identical to the developer stack's history dump. So the developer database has exactly the checked-in history. The `profile_isa_accounts` object that the plan observed there has no migration row, which makes it unrecorded local state. I did not inspect the developer schema.

`profile_isa_accounts` is absent from the checked-in migrations and from the fresh replay. A catalog search for any relation named `%isa%` or function named `%isa_account%` outside `pg_catalog` and `information_schema` returned zero rows. No ISA migration was committed since the plan was written, so there is no new state to reconcile, and the replay is not contaminated.

### Clean public inventory

Objects in `public` that are not extension members (no `pg_depend` `deptype = 'e'`), identities only.

Tables: 38, all ordinary tables (`relkind r`), all with RLS enabled and none with forced RLS. Canonical list sha256 `a93d7da167cfd4f57c2ade93eabdeaaf272a569d44637b542d33257bf69bfb75`.

```text
app_config association_people choosen_course_entitlements contribution_plan_assignments
contribution_schedules entry events favorite_highline festival festival_companion_config
festival_companion_tokens festival_highline festival_schedule_booking festival_schedule_revision
festival_schedule_slot festival_schedule_window festival_staff highline
membership_application_revisions membership_applications news news_comments news_reactions
notifications organization_members organization_membership_departures organizations
payment_claim_audit_events payment_claims payment_obligations profiles push_tokens rig_setup
rig_setup_webbing sector trails webbing webbing_model
```

There are no views, materialized views, partitioned or foreign tables in `public`.

Functions: 82, all `prokind f`, 54 of them `SECURITY DEFINER`. Identity arguments are recorded in the private `inv/functions.txt`, sha256 `a5c373a55a94b7d44f77f250650afda243b27917f85764a28d06f9514dfc9e15`. The format is `public.<name>(<identity args>) kind=<k> secdef=<bool>`. Names:

```text
approve_initial_claim approve_recurring_payment_claim book_festival_schedule_slot
cancel_festival_schedule_booking claim_initial_payment claim_recurring_payment clamped_billing_date
end_association_membership enqueue_festival_companion_after_booking
enqueue_festival_companion_notifications enqueue_festival_schedule_open_notifications
ensure_contribution_schedule first_recurring_due_date generate_highline_slug
generate_membership_billing_obligations generate_membership_billing_obligations_at
get_association_member_detail get_billing_workspace_claim_detail get_billing_workspace_members
get_billing_workspace_organizations get_billing_workspace_payments get_billing_workspace_people
get_billing_workspace_queue get_crossing_time get_festival_schedule_booking_cooldown_ends_at
get_festival_schedule_booking_cooldown_seconds get_festival_schedule_booking_limit
get_festival_schedule_bookings get_highline get_initial_payment_claim_detail
get_initial_payment_claim_queue get_membership_billing_ledger get_payment_obligation_instructions
get_total_cadenas get_total_full_lines get_total_walked get_webbing_usage_days
handle_blocked_festival_schedule_slot handle_festival_highline_duration_change
handle_festival_schedule_window_change handle_new_user highlines_in_view is_festival_staff
is_person_link_maintenance is_valid_billing_timezone next_recurring_due_date
normalize_festival_instagram_username normalize_profile_username
prepare_association_account_deletion profile_stats profile_username_disambiguated
reconcile_festival_schedule reconcile_festival_schedule_by_id recurring_due_date_on_or_after
recurring_period_key regenerate_festival_schedule_window register_festival_companion_token
register_push_token reject_contribution_plan_assignment_mutation
reject_contribution_schedule_anchor_mutation reject_initial_claim
reject_membership_application_revision_mutation reject_membership_departure_mutation
reject_payment_claim_audit_mutation reject_payment_claim_evidence_mutation
reject_payment_obligation_context_mutation reject_recurring_payment_claim
resolve_association_person set_association_person_from_obligation
set_association_person_from_subject set_highline_slug set_membership_applications_updated_at
set_normalized_profile_username slugify snapshot_payment_obligation_context
submit_association_application touch_festival_schedule_revision
unregister_festival_companion_installation unregister_push_token update_app_config_updated_at
validate_billing_policy_timezone validate_locale_keys
```

The replay has `choosen_course_entitlements`, `festival_companion_config`, `festival_companion_tokens` and `unregister_festival_companion_installation(installation_id_input uuid)`. It has no `register_festival_companion_installation`. See Deviations.

### Environment metadata

Recorded for reference only. Plan 003 Step 2 must establish extension provenance with a fresh replay before lint or pgTAP runs, because this stack has already run both.

- Server: `server_version` 15.19, `server_version_num` 150019.
- Extensions after verification, as `name version schema`: `pg_cron 1.6.4 pg_catalog`, `pg_graphql 1.6.2 graphql`, `pg_net 0.20.4 extensions`, `pg_stat_statements 1.10 extensions`, `pgcrypto 1.3 extensions`, `pgjwt 0.2.0 extensions`, `plpgsql 1.0 pg_catalog`, `postgis 3.3.2 extensions`, `supabase_vault 0.3.1 vault`, `unaccent 1.1 extensions`, `uuid-ossp 1.1 extensions`. `pgtap` is not installed after the run.
- Schemas, excluding toast and temp: `_realtime auth cron extensions gis graphql graphql_public information_schema net pg_catalog pgbouncer public realtime storage supabase_functions supabase_migrations vault`.

### Compiler baseline before any type change

Commands from the worktree root, run one after another with output redirected to `tsc-before/<pkg>.out|.err|.exit`:

| Command | Exit | Diagnostics |
| --- | --- | --- |
| `pnpm --filter chooselife-web exec tsc --noEmit --incremental false` | 1 | 1: TS2307 ×1 |
| `pnpm --filter chooselife-mobile exec tsc --noEmit --incremental false` | 1 | 7: TS2578 ×6, TS2882 ×1 |
| `pnpm --filter @chooselife/ui exec tsc --noEmit --incremental false` | 0 | 0 |

Stderr was empty for all three. The sorted `error TS` lines are in `tsc-before/<pkg>.diagnostics` with sha256 prefixes web `5f52ed58f9448924`, mobile `8ec68502b1c9b1f4`, ui `e3b0c44298fc1c14` (empty).

Web:

```text
app/[locale]/_components/hero-promo-card.tsx(7,29): error TS2307: Cannot find module '@/assets/images/highline-walk.webp' or its corresponding type declarations.
```

Mobile:

```text
app/_layout.tsx(1,8): error TS2882: Cannot find module or type declarations for side-effect import of '~/global.css'.
app/en/[...slug].tsx(7,3): error TS2578: Unused '@ts-expect-error' directive.
app/highline/[id]/_layout.tsx(82,3): error TS2578: Unused '@ts-expect-error' directive.
app/news/[newsSlug].tsx(153,5): error TS2578: Unused '@ts-expect-error' directive.
app/pt/[...slug].tsx(7,3): error TS2578: Unused '@ts-expect-error' directive.
components/event-card.tsx(401,19): error TS2578: Unused '@ts-expect-error' directive.
hooks/use-deep-link-handler.tsx(72,5): error TS2578: Unused '@ts-expect-error' directive.
```

None of the eight diagnostics mention database or Supabase types. The baseline does **not** pass. These failures are recorded as existing debt, and nothing was changed to fix them.

Likely cause, from read-only checks only. This worktree has none of the gitignored framework-generated declarations that the parent checkout has: `next/next-env.d.ts` (`next/.gitignore:36`), `next/.next/types`, `expo/expo-env.d.ts` (`expo/.gitignore:50`) and `expo/.expo/types`. Next's `next-env.d.ts` normally supplies the `*.webp` module declarations. Expo's environment file and generated router types normally supply CSS side-effect and typed-route declarations, and typed routes would make the `@ts-expect-error` directives used. I did not generate those files or run the typecheck in the read-only parent. So this cause is unconfirmed, and a fully generated environment could show different diagnostics.

Step 4 compares its after-typecheck against these exact lines in the same environment. The plan's gate requires all three typechecks to exit 0, and that cannot happen without a separate decision. Either generate the framework declarations as an environment step, or accept and scope these pre-existing errors. That decision is the root's.

## Deviations

- Plan text says the companion RPCs are `register_festival_companion_installation` and `unregister_festival_companion_installation`. The migration `supabase/migrations/20260730140837_festival_live_companion.sql:65` defines `register_festival_companion_token(installation_id_input uuid, token_type_input text, activity_name_input text, token_input text, language_input language)`, and `:139` defines `unregister_festival_companion_installation(uuid)`. No `register_festival_companion_installation` exists in the migrations, the replay, or any tracked source. Step 4's `rg` identity check should use `register_festival_companion_token`. Otherwise it cannot find all five identities from a correct full regeneration. This is a plan correction, not a schema difference. Neither function is in the current tracked type artifact.
- The plan expected the developer database to differ from the checked-in history only by `profile_isa_accounts`. The history comparison shows both have the same 41 versions and names (identical sha256), so that object exists in the developer DB without any migration record. I did not inspect the developer schema to confirm the object itself.
- The compiler baseline fails in web and mobile before any type change. Recorded above. Nothing was fixed.
- Inventory queries passed SQL as the positional argument with `--output json` and `--agent no`. Step 3's `--file` form is unchanged and will be checked when `catalog.sql` exists.
- The worktree was not based on the parent's current `HEAD` `b793adf` (`refactor(webbing): clear React Doctor issues in the catalog picker`). That commit is not an ancestor of this branch. The compiler baseline therefore reflects `abd5a18`, not the parent checkout.

## How the run ended

Step 1 is done locally and waits for a fresh review. Prerequisites hold: CLI 2.121.0, 39/39 helper tests, and `pnpm db:verify --keep` passing with 41/41 migrations, a clean lint and 12 files with 371 assertions. The clean replay's applied versions equal the checked-in migrations exactly. `profile_isa_accounts` is absent from both the migrations and the replay. The public inventory is 38 tables and 82 functions. The compiler baseline is web exit 1 (1 diagnostic), mobile exit 1 (7) and UI exit 0. The developer `chooselife` stack is unchanged. The owned stack `chooselife-verify-049997ac2680` is retained at `/private/var/folders/4d/px4017t53z7dx66qvy4fcvx00000gn/T/chooselife-verify-QD2JDJ` for the next steps.

Steps 2–5 have not started. No catalog SQL, comparator, type regeneration, route change, workflow change or hosted inspection happened. Plan 003 is not done.
