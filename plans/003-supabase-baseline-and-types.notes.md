# Plan 003 execution notes

Worktree `/Users/juangsandrade/.t3/worktrees/chooselife/t3-f4bb91a0`, branch `t3/supabase-schema-workflow`. Each numbered step gets a separate review before the next one starts.

| Commit | Meaning |
| --- | --- |
| `abd5a18` | Plan 002 accepted. Implementation base for Step 1 |
| `ff2bd8f` | Step 1: clean migration and compiler baseline, notes only |
| `6481a03` | Parent acceptance of Step 1 and prepared compiler baseline. Base for Step 2 |
| Commit that adds the catalog files | Step 2: catalog query, comparator, tests and `db:catalog:compare` |

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

## Parent review and prepared compiler baseline

Fresh Sol review `/root/supabase_003_1_review` returned SHIP with no blocking findings. It checked the complete notes diff, retained evidence, copied migration bytes, workspace ownership and developer preservation snapshots. The parent independently validated ownership, queried the live retained database and matched all 41 applied versions to filenames. The live counts are 38 public tables and 82 public functions, with `profile_isa_accounts` absent. The parent also reproduced the raw web/mobile/UI diagnostics above.

The parent then prepared the normal ignored framework declarations before any database-type change. Installed CLI inspection and the official Next/Expo documentation identify these commands:

```bash
CI=1 NEXT_TELEMETRY_DISABLED=1 NEXT_PUBLIC_SUPABASE_URL=https://example.supabase.co node next/node_modules/next/dist/bin/next typegen next
# From expo/:
APP_VARIANT=development CI=1 EXPO_OFFLINE=1 EXPO_NO_TELEMETRY=1 node node_modules/expo/bin/cli customize tsconfig.json
```

Both exited 0. The URL is a nonsecret configuration placeholder, not a database connection. Next generated its ignored environment and route types; Expo generated its ignored environment and router types without starting a server. `git check-ignore` confirms the generated locations are ignored, and tracked files remained unchanged.

An initial `pnpm --dir next exec next typegen` invocation triggered pnpm 11's automatic dependency install before reaching Next, then stalled. The parent terminated that owned install process and used the direct installed CLI. A subsequent root `pnpm install --frozen-lockfile` completed successfully with no tracked changes. No credentials or source fixes were needed.

The parent repeated the exact three compiler commands after preparation. Web, mobile and shared UI each exited 0 with no diagnostics. This prepared baseline is the comparison baseline for regeneration; the raw eight errors above remain recorded as evidence of missing generated declarations in a fresh worktree, not unresolved application debt. Plan 003 now documents this setup and corrects the registration RPC to `register_festival_companion_token`.

Root accepts checkpoint 003.1. The owned database is still retained for Step 2; source, SQL, config and generated database types remain unchanged.

## Step 2: reusable catalog comparison

Status: done locally, waiting for review. Added `supabase/verification/catalog.sql`, `scripts/check-database-catalog.mjs`, `scripts/check-database-catalog.test.mjs` and the root `db:catalog:compare` script. No migration, seed, SQL test, config, generated type, route, workflow, README, lockfile or dependency changed. `scripts/verify-database.mjs` is untouched; runner integration is Step 5 (checkpoint 003.5). It already copies `supabase/verification/` into the disposable project.

Private evidence: `/var/folders/4d/px4017t53z7dx66qvy4fcvx00000gn/T/chooselife-003-2-private.zIo6uC` (mode 700). It holds the before/after Docker snapshots, every capture under `cap/`, the lint and pgTAP output, and the rollback fixture under `bin/`. The scan for `sb_secret_`, `sb_publishable_`, JWTs, `Bearer`, `decrypted_secret` and `net.http` found nothing in the captures.

### Sources checked first

- Supabase skill and Postgres best practices. The Supabase changelog's breaking changes since 2025 include tables no longer auto-exposed to the Data API (2026-04-28) and Realtime schema lock-down (2026-07-14). Both make default ACLs and managed-schema grants worth capturing. None changes the query interface.
- Pinned CLI help: `db query [flags] [<sql>]` with `--local`, `--linked`, `--db-url`, `--file/-f`. `db reset` has `--local`, `--version`, `--last`, `--no-seed`.
- Pinned CLI source at `v2.121.0` (`query.handler.ts`, `query.format.ts`). JSON output is a row array. Agent mode wraps it as `{boundary, rows, warning}` with an optional `advisory`. `--output-format stream-json` emits `{"type":"result","data":…,"timestamp":…}`. Go-style escaping turns `<` into `\u003c`. Local jsonb arrives parsed.
- Supabase MCP `execute_sql` source: it returns `{result: string}`, where the text wraps `JSON.stringify(rows)` in `<untrusted-data-<uuid>>` tags on their own lines. The preamble sentence also names the tag. The comparator therefore matches only tags on their own line.

All three CLI shapes were exercised live against the owned stack. The connector shape was exercised by wrapping a real capture in the documented format. No connector or cloud call happened in this checkpoint.

### What the query captures

`catalog.sql` is one `SELECT` returning one row with one jsonb column, `catalog`. Its only side effect is `set_config('search_path', '', true)` in a materialized first CTE. The final `SELECT` scans that row before evaluating anything that deparses SQL. Without it, `regclass`, `format_type`, `pg_get_expr`, index and constraint definitions print `public.` or not depending on the client's `search_path`. The CLI and the connector need not agree on that. Evidence: index IDs come out as `public.app_config_pkey`, and function identities as `…language_input public.language`.

Sections, each an array of objects with a stable `id`:

| Section | Facts |
| --- | --- |
| `extensions` | Name and schema. Versions live in `environment.extension_versions` |
| `schemas` | Every non-system schema: owner, extension membership, comment, ACL, effective `USAGE`/`CREATE` |
| `relations` | Tables, views, materialized and foreign tables, sequences. Kind, owner, persistence, options, RLS enabled/forced, replica identity and its index, partitioning, inheritance, view digest, comment, ACL, effective privileges. Columns are kept in `attnum` order with type, nullability, default, identity, generated, collation, comment, column ACL, and effective column privileges where a column ACL exists. Sequence definitions, never current values |
| `constraints` | Table and domain constraints: type, definition, deferrability, validation, comment |
| `indexes` | Definition (key order included), unique, primary, valid, constraint-backed, comment |
| `types` | Enums with labels in `enumsortorder`, domains, composites with ordered attributes, ACL |
| `functions` | Identity with ordered arguments, kind, owner, language, result, digest of the full argument list with defaults, body digest, definer flag, volatility, strict, leakproof, parallel, cost, rows, `proconfig`, comment, ACL, effective `EXECUTE` |
| `policies` | Command, permissive, roles, `USING` and `WITH CHECK` digests, comment |
| `triggers` | Function identity, enabled state, timing, level, events, constraint/deferral flags, digest of the full definition |
| `rules`, `event_triggers` | Non-view rules on included relations, and database-owner event triggers |
| `default_acls` | Rows for the database owner, plus any role's rows in `public` |
| `managed_grants` | Grants whose grantor is the database owner on objects it does not own, such as the migration's `USAGE` on `cron` |
| `publications`, `publication_tables` | Flags, owner, schema membership, member tables, column lists, row-filter digest |
| `cron_jobs` | By name: schedule, active, database, user, command digest |
| `storage_buckets` | By name: whether `id` equals the name, `public`, size limit, MIME types |

ACL entries read `grantee:PRIVILEGE`, with `*` when grantable. `aclexplode` grantee 0 is `PUBLIC`. A null ACL is expanded through `acldefault`, so an implicit default and the same explicit grants compare equal. Effective privileges come from `has_*_privilege` for `anon`, `authenticated` and `service_role`, never for `PUBLIC`.

`environment` holds the server version, the database owner (`app_owner`), `complete_visibility` (the capturing role is superuser or has `BYPASSRLS`), and extension versions. `counts` repeats every section's length.

### Scope from ownership and dependencies

The live inventory decided the rules. Extension-owned objects have `pg_depend` `deptype = 'e'`; `cron` and `net` are themselves extension-member schemas. Platform objects belong to `supabase_admin`, `supabase_auth_admin`, `supabase_storage_admin`, `supabase_realtime_admin` and `supabase_functions_admin`. The database owner (`pg_database.datdba`, `postgres`) runs migrations, and owns all 82 public functions and the public tables. Outside `public`, it owns only `supabase_migrations`. The `auth.users` trigger calls `public.handle_new_user()`, owned by `postgres`, while every platform trigger's function shares its table's platform owner.

So the query keeps:

- Every non-extension object in `public`, whatever its owner, with the owner recorded.
- Objects anywhere else owned by the database owner. `gis` is an application schema created by a migration; it is listed and currently empty.
- Policies on any non-extension table, since policies have no owner. Today none exist outside `public`. The two `cron` policies sit on extension-member tables.
- Triggers on included tables, or calling a database-owner function. That keeps `auth.users.on_auth_user_created` and drops the ten storage, realtime and cron platform triggers.
- Every non-system schema, so an extra schema appears by name.

There is one name-based exclusion: `supabase_migrations`, the migration bookkeeping the plan excludes. No platform object-name ignore list exists.

Counts on the clean replay: 11 extensions, 15 schemas, 47 relations (38 tables and 9 sequences), 180 constraints, 109 indexes, 21 types (all enums), 82 functions, 66 policies, 29 triggers, 0 rules, 0 event triggers, 9 default ACLs, 3 managed grants, 1 publication with 4 tables, 3 cron jobs and 4 buckets.

### Comparator

`node scripts/check-database-catalog.mjs <left> <right>` (or `pnpm db:catalog:compare`) uses only Node built-ins. It accepts:

- the bare document
- CLI rows, with jsonb parsed or as text
- the agent envelope
- stream-json, either one line or with other events alongside exactly one result
- connector text, or connector `{result}`

It fails closed with exit 2 on:

- empty, malformed or truncated JSON
- zero or multiple rows, or an extra column
- a wrong `format`
- a missing or unknown section
- a count mismatch
- an entry without an `id`, or a duplicate `id`
- `complete_visibility` false
- mismatched or repeated connector blocks, or stream-json without a result

Exit 1 lists semantic differences by section, identity and field path. Exit 0 means the application semantics match.

- Sections are matched by `id`, so their order never matters.
- Columns and composite attributes are compared by name sequence first, then per name.
- Enum labels and column lists are compared in order.
- Index key order lives in the index definition, and argument order in the function identity.
- Set fields ignore order: ACLs, policy roles, trigger events, options, `proconfig`, publication schemas, event trigger tags, inheritance and MIME types, plus every list under `effective`.
- Only grant entries, roles, events, privileges, column names and identities are named. Digests, definitions, defaults, comments and config values are reported as `differs`.

Platform patch differences, the server version and extension versions, are printed as environment metadata and do not change the exit code. A missing extension, a different schema placement or a different database owner is semantic.

### Verification

| Command | Result |
| --- | --- |
| `node --test scripts/check-database-catalog.test.mjs` | exit 0, 44/44 |
| `node --test scripts/check-database-catalog.test.mjs scripts/verify-database.test.mjs` | exit 0, 83/83 (39 existing helper tests unchanged) |
| `prettier --check scripts/*.mjs` (repository Prettier 3.8.1) | exit 0 after `--write` on the two new files |

The tests use synthetic metadata only:

- Each of these is detected, with an exact message: a lost policy, a changed `EXECUTE` grant (ACL and effective), an altered body digest, a missing `auth.users` trigger, a changed cron command digest, changed enum order, changed column order and column fields, changed index key order and changed function argument order.
- Reversed sections, ACLs, roles, effective lists, MIME types and object key order compare equal.
- Platform patch versions are environment metadata. A missing extension and an owner change are semantic.
- Seven wrapper forms are accepted and 17 invalid inputs are rejected.
- `main` returns exit 0, 1 and 2 as specified, and no digest or definition text appears in its output.

Live checks on the owned stack. `assertOwnedWorkspace({root, projectId})` from `scripts/verify-database.mjs` passed before every query, reset and transaction. Each capture used `supabase --workdir "$DB_VERIFY_WORKDIR" --agent no db query --local --file "$PWD/supabase/verification/catalog.sql" --output json` with stdout redirected.

| Check | Result |
| --- | --- |
| Two read-only captures of the retained stack | exit 0 each, byte-identical (sha256 `e00afe4c…6baf6`), compare exit 0 |
| `--agent yes` envelope and `--output-format stream-json` captures of the same state | each compares equal to the JSON capture, exit 0 |
| Real capture rewrapped as connector `{result}` text | compares equal, exit 0 |
| `psql` as `supabase_admin` in the owned DB container, `begin; catalog; rollback` | equal to the CLI capture as `postgres`, exit 0 |
| Rolled-back mutations, run as `supabase_admin` in one transaction | compare exit 1 with exactly 10 lines. Listed below |
| CLI capture after that rollback | equal to the baseline, exit 0 |

The ten rollback mutations and what each one reported:

- Dropped the `choosen_course_entitlements` read policy: `policies …: only in left`.
- Revoked `EXECUTE` on `register_festival_companion_token` from `authenticated`: the `acl` and `effective.authenticated` lines.
- Granted `SELECT` on `choosen_course_entitlements` to `anon`: the `acl` and `effective.anon` lines.
- Prefixed `slugify`'s body with one space: `body_digest: differs`.
- Dropped `auth.users.on_auth_user_created`: `only in left`.
- Ran `cron.alter_job` on `festival-schedule-reconcile-every-minute` with a trailing space: `command_digest: differs`.
- Ran `alter type public.language add value … before 'en'`: `labels: differs`.
- Added a column to `app_config`: `columns: … only in right: fixture_note`.

### Verification-tool provenance

Run against the owned stack after an ownership check:

1. Reset it to all migrations with seeds: `db reset --local --yes`, exit 0, 03:13:37–03:14:04 UTC. The CLI recreated the owned DB container (new ID, same name and image), and its volumes stayed. Applied history then had 41 rows, `20250206202200`–`20261015013845`.
2. Captured the catalog before lint or pgTAP. Extensions at that point: `pg_cron 1.6.4, pg_graphql 1.6.2, pg_net 0.20.4, pg_stat_statements 1.10, pgcrypto 1.3, pgjwt 0.2.0, plpgsql 1.0, postgis 3.3.2, supabase_vault 0.3.1, unaccent 1.1, uuid-ossp 1.1`. All of them come from migrations or the platform image; `unaccent` comes from `20261009120000_add_highline_slug.sql:5`.
3. Ran the verifier's lint, `db lint --local --schema public --level error --fail-on error`: exit 0. Then captured.
4. Ran the verifier's pgTAP, `test db --local <workdir>/supabase/tests`: exit 0, `Files=12, Tests=371`, `Result: PASS`. Then captured.

Pre-tool vs after lint, after lint vs after pgTAP, and pre-tool vs after pgTAP all exit 0. The extension list is identical afterwards. The pre-tool capture also equals the capture of the stack Step 1 retained after its full verification. Lint and pgTAP leave nothing in the catalog, so no verification-only exclusion exists in the query. Step 5 should still capture before lint and pgTAP, so a future helper that leaks shows up as a difference instead of hiding.

The same replay showed why buckets are keyed by name. `20250407023808_buckets.sql` inserts `gen_random_uuid()` IDs, and the `avatars` ID changed between the retained stack and the fresh reset. Comparing raw bucket IDs would make two clean replays differ.

### Preservation and retained stack

Developer stack, read the same way as Step 1:

- The 12 `supabase_*_chooselife` inspect records (name, ID, `StartedAt`, `RestartCount`) are byte-identical before and after.
- Volume and network names are identical.
- The history dump is identical, sha256 `2b6d8c03…f027`, 41 rows.
- The only `docker ps` difference is the owned DB container recreated by the reset.

The owned stack `chooselife-verify-049997ac2680` is retained at the same path, ports and cleanup command recorded in Step 1. It has seven containers, two volumes and one network. Its state is again all 41 migrations with seeds, after lint and pgTAP, the same as Step 1 left it. Clean it up only through that cleanup command, after `assertOwnedWorkspace`.

### Known limits

- Grantors are omitted from ACL entries. A revoke on a platform object leaves no trace, so `managed_grants` sees only database-owner grants.
- Outside `public`, an object owned by a role other than the database owner is not captured; only its schema is listed. For example, something created as `supabase_admin` in a managed schema. In `public`, every non-extension object is captured with its owner.
- A platform-created policy on a managed table would be captured as if it were the application's. None exists locally; the stage comparison would show it by name.
- Not captured: roles and memberships, casts, operators and operator classes, statistics objects, collations, text search configuration, foreign servers, Auth settings outside the database, vault secrets (by design) and stored objects.
- Deparsed definitions come from the server. A different Postgres major on staging could print equivalent SQL differently; that would show as named differences, not be hidden. Formatting is not normalized beyond CRLF.
- The query requires Postgres 15+ catalogs (`prattrs`, `pg_publication_namespace`), `cron.job` and `storage.buckets`. If one is missing it errors instead of returning a partial result.
- A role that neither is superuser nor has `BYPASSRLS` would see RLS-filtered `cron.job` and `storage.buckets` rows. The comparator rejects such a capture rather than trusting it.
- The live connector path and its size limits are untested, because this checkpoint has no cloud access. The compact payload is about 300 KB; the CLI's pretty JSON is about 500 KB.

## Deviations

- Plan text says the companion RPCs are `register_festival_companion_installation` and `unregister_festival_companion_installation`. The migration `supabase/migrations/20260730140837_festival_live_companion.sql:65` defines `register_festival_companion_token(installation_id_input uuid, token_type_input text, activity_name_input text, token_input text, language_input language)`, and `:139` defines `unregister_festival_companion_installation(uuid)`. No `register_festival_companion_installation` exists in the migrations, the replay, or any tracked source. Step 4's `rg` identity check should use `register_festival_companion_token`. Otherwise it cannot find all five identities from a correct full regeneration. This is a plan correction, not a schema difference. Neither function is in the current tracked type artifact.
- The plan expected the developer database to differ from the checked-in history only by `profile_isa_accounts`. The history comparison shows both have the same 41 versions and names (identical sha256), so that object exists in the developer DB without any migration record. I did not inspect the developer schema to confirm the object itself.
- The compiler baseline fails in web and mobile before any type change. Recorded above. Nothing was fixed.
- Inventory queries passed SQL as the positional argument with `--output json` and `--agent no`. Step 3's `--file` form is unchanged and will be checked when `catalog.sql` exists.
- The worktree was not based on the parent's current `HEAD` `b793adf` (`refactor(webbing): clear React Doctor issues in the catalog picker`). That commit is not an ancestor of this branch. The compiler baseline therefore reflects `abd5a18`, not the parent checkout.
- Step 2 adds a `storage_buckets` section that the plan's list does not name. Bucket rows are platform configuration, not user data, and `public` controls anonymous reads. Buckets are keyed by name because a migration assigns random IDs (see Step 2). This is the only value normalization besides CRLF.
- Step 2 treats extension presence and schema placement as application semantics and only extension versions as environment metadata. The plan lists all three as environment metadata; a missing extension would break application functions, so it is not reported as harmless.
- Step 2 sets `search_path` to empty for the query's own transaction with `set_config`. That is the one statement-level side effect in an otherwise read-only query. Without it, identities and definitions depend on the client.
- Step 2 found no verification-only extension or helper to exclude. The plan anticipated some. The pre-tool and post-tool captures are equal, so the query has no provenance exclusion.

## How the run ended

Step 1 is accepted. Prerequisites held: CLI 2.121.0, 39/39 helper tests, and `pnpm db:verify --keep` passing with 41/41 migrations, a clean lint and 12 files with 371 assertions. The clean replay matches the checked-in migrations exactly. It has 38 public tables and 82 public functions, and no `profile_isa_accounts`. The raw compiler baseline in a fresh worktree was web exit 1, mobile exit 1 and UI exit 0, with eight diagnostics from missing framework declarations. After the parent prepared the ignored Next and Expo declarations, all three typechecks exit 0 with no diagnostics. That prepared baseline is the one later steps compare against.

Step 2 is done locally and waits for review. `supabase/verification/catalog.sql` returns one nonsecret JSON catalog. `pnpm db:catalog:compare` compares two captures and exits 0, 1 or 2. 44 new tests pass beside the 39 existing ones. Two real captures compare equal. Live rolled-back mutations are each detected by identity. Lint and pgTAP leave no catalog residue. The developer `chooselife` stack is unchanged. The owned stack `chooselife-verify-049997ac2680` is retained at `/private/var/folders/4d/px4017t53z7dx66qvy4fcvx00000gn/T/chooselife-verify-QD2JDJ`, in full migrations-plus-seeds state, for Step 3.

Steps 3–5 have not started. No staging inspection, versioned reset, type regeneration, route change, runner integration, workflow or README change happened. Plan 003 is not done.
