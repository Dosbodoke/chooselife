# Plan 003 execution notes

Worktree `/Users/juangsandrade/.t3/worktrees/chooselife/t3-f4bb91a0`, branch `t3/supabase-schema-workflow`. Each numbered step gets a separate review before the next one starts.

| Commit | Meaning |
| --- | --- |
| `abd5a18` | Plan 002 accepted. Implementation base for Step 1 |
| `ff2bd8f` | Step 1: clean migration and compiler baseline, notes only |
| `6481a03` | Parent acceptance of Step 1 and prepared compiler baseline. Base for Step 2 |
| `4185828` | Step 2: catalog query, comparator, tests and `db:catalog:compare` |
| Commit after `4185828` that changes the catalog files | Step 2 revision 1: the four fresh-review corrections |

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

Status: revision 1 done locally after a FIX-FIRST fresh review. Waiting for a new review; not accepted. Revision 1 is recorded below, and the contract sections in this step describe the revised query and comparator. Original: added `supabase/verification/catalog.sql`, `scripts/check-database-catalog.mjs`, `scripts/check-database-catalog.test.mjs` and the root `db:catalog:compare` script. No migration, seed, SQL test, config, generated type, route, workflow, README, lockfile or dependency changed. `scripts/verify-database.mjs` is untouched; runner integration is Step 5 (checkpoint 003.5). It already copies `supabase/verification/` into the disposable project.

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
| `extensions` | Name and schema, plus the security state shared by most of the extension's routines (`routine_security`) and types (`type_security`). Versions live in `environment.extension_versions` |
| `schemas` | Every non-system schema: owner, extension membership, comment, ACL, effective `USAGE`/`CREATE` |
| `relations` | Tables, views, materialized and foreign tables, sequences. Kind, owner, persistence, options, RLS enabled/forced, replica identity and its index, partitioning, inheritance, view digest, comment, ACL, effective privileges. Columns are kept in `attnum` order with type, nullability, default, identity, generated, collation, comment, column ACL, and effective column privileges where a column ACL exists. Sequence definitions, never current values |
| `constraints` | Table and domain constraints: type, definition, deferrability, validation, comment |
| `indexes` | Definition (key order included), unique, primary, valid, constraint-backed, comment |
| `types` | Enums with labels in `enumsortorder`, domains, composites with ordered attributes, ACL |
| `functions` | Identity with ordered arguments, kind, owner, language, result, digest of the full argument list with defaults, body digest, definer flag, volatility, strict, leakproof, parallel, cost, rows, `proconfig`, comment, ACL, effective `EXECUTE` |
| `policies` | On every table in scope, platform and extension tables included. Command, permissive, roles, `USING` and `WITH CHECK` digests, comment |
| `triggers` | On every table in scope. Function identity, enabled state, timing, level, events, constraint/deferral flags, digest of the full definition |
| `rules`, `event_triggers` | Non-view rules on every relation in scope. Every event trigger, with its owner |
| `default_acls` | Every `pg_default_acl` row |
| `managed_security` | Every relation, function and type outside the application scope: owner, kind, extension, full ACL, effective privileges, RLS enabled/forced (relations), definer flag and `proconfig` (functions), and each column that has its own ACL with that ACL and effective column privileges. Extension routines and types in their extension's common state are folded into the `extensions` entry |
| `publications`, `publication_tables` | Every publication and member table. Flags, owner, schema membership, column lists, row-filter digest |
| `cron_jobs` | By name: schedule, active, database, user, command digest |
| `storage_buckets` | By name: whether `id` equals the name, `public`, size limit, MIME types |

ACL entries read `grantee:PRIVILEGE`, with `*` when grantable. `aclexplode` grantee 0 is `PUBLIC`. A null ACL is expanded through `acldefault`, so an implicit default and the same explicit grants compare equal. Effective privileges come from `has_*_privilege` for `anon`, `authenticated` and `service_role`, never for `PUBLIC`.

Revision 1 bumped the payload `format` to `chooselife.catalog.v2`, because `managed_grants` became `managed_security` and records gained fields. A v1 capture is rejected rather than compared.

`environment` holds the server version, the database owner (`app_owner`), `complete_visibility` (the capturing role is superuser or has `BYPASSRLS`), and extension versions. `counts` repeats every section's length.

### Scope from ownership and dependencies

The live inventory decided the rules. Extension-owned objects have `pg_depend` `deptype = 'e'`; `cron` and `net` are themselves extension-member schemas. Platform objects belong to `supabase_admin`, `supabase_auth_admin`, `supabase_storage_admin`, `supabase_realtime_admin` and `supabase_functions_admin`. The database owner (`pg_database.datdba`, `postgres`) runs migrations.

Revision 1 rules (the original rules are kept under Revision 1 for the record):

- Application schemas are `public` and every non-extension schema owned by the database owner. On the local image that is `public`, `gis`, `extensions` and `_realtime`. `supabase_migrations` is skipped by name; it is the one name-based exclusion.
- Application objects are the non-extension relations, functions and types in application schemas, whatever their owner, plus non-extension objects the database owner owns anywhere. They are captured in full, owner included. Constraints, indexes, column metadata and domain constraints follow them.
- Everything else (platform objects and extension members) goes to `managed_security` with its security state only. Platform function bodies and table definitions are not read.
- Extension routines and types are grouped per extension and kind. The most frequent security state (ties broken by its JSON text) goes on the `extensions` entry, and only members whose state differs are listed. This keeps 744 postgis functions out of the payload, while a grant or revoke on one of them lists it by name and a blanket change shows on the extension. `pg_init_privs` could not be used instead: postgis functions got their ACL from default privileges at creation, which Postgres 15 does not record there, so 744 of 837 extension functions looked changed on a clean replay.
- Extension member relations are always listed individually, so RLS flags on `cron.job` or `vault.secrets` are compared.
- Policies, triggers, rules, event triggers, default ACLs and publications are captured wherever they are. No ownership heuristic decides whether a trigger is custom, so a webhook trigger on `auth.users` calling `supabase_functions.http_request` is captured, and so are the ten platform triggers.
- Every non-system schema is listed, so an extra schema appears by name.

No platform object-name ignore list exists.

Counts on the clean replay after revision 1: 11 extensions, 15 schemas, 51 relations (42 tables, 9 sequences), 187 constraints, 117 indexes, 21 types, 88 functions, 68 policies, 39 triggers, 3 rules, 8 event triggers, 30 default ACLs, 137 managed entries (65 relations, 57 functions, 15 types; 28 belong to an extension), 1 publication with 4 tables, 3 cron jobs and 4 buckets. Compared with the original query, the four `_realtime` tables and the six `extensions` event-trigger helper functions became application objects; the two `cron` policies, ten platform triggers, three postgis view rules, eight platform event triggers and 21 more default ACL rows are now captured. The compact payload grew from about 300 KB to 408 KB.

### Comparator

`node scripts/check-database-catalog.mjs <left> <right>` (or `pnpm db:catalog:compare`) uses only Node built-ins. It accepts:

- the bare document
- CLI rows, with jsonb parsed or as text
- the agent envelope
- stream-json, either one line or with log and progress events alongside exactly one result
- connector text, or connector `{result}`

It fails closed with exit 2 on:

- empty, malformed or truncated JSON
- zero or multiple rows, or an extra column
- a wrong `format`
- a missing or unknown section
- a count mismatch
- an entry without an `id`, or a duplicate `id`
- any record whose shape differs from what `catalog.sql` emits: a missing or extra field, a wrong type or nullability, a malformed digest or ACL entry, `effective` without exactly `anon`, `authenticated` and `service_role`, duplicate column, attribute, ACL, role or label entries, a managed entry whose kind-specific security fields are missing, or a folded extension state that does not have its kind's fields (a routine state needs a boolean definer flag and a settings array, and its RLS flags and columns must be null; every kind-specific field of a type state must be null)
- counts or environment with missing or extra keys
- `complete_visibility` false
- connector text without exactly one opening tag line and its matching closing tag line, so a second or truncated block is rejected. Every other tag occurrence must be a complete tag inside a sentence. A partial opening or closing tag anywhere, or a tag line with anything after the tag, is rejected
- stream-json without exactly one result, or with an `error` event or `error`-level log anywhere

Exit 1 lists semantic differences by section, identity and field path. Exit 0 means the application semantics match.

- Sections are matched by `id`, so their order never matters.
- Columns and composite attributes are compared by name sequence first, then per name.
- Enum labels and column lists are compared in order.
- Index key order lives in the index definition, and argument order in the function identity.
- Set fields ignore order: ACLs, policy roles, trigger events, options, `proconfig`, publication schemas, event trigger tags, inheritance and MIME types, plus every list under `effective`.
- Only grant entries, roles, events, privileges, column names and identities are named. Digests, definitions, defaults, comments and config values are reported as `differs`.

Platform patch differences, the server version and extension versions, are printed as environment metadata and do not change the exit code. A missing extension, a different schema placement or a different database owner is semantic.

### Verification

Original run at `4185828`. Revision 1's results are under Revision 1.

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

Original run at `4185828`; revision 1 repeated it with the same result. Run against the owned stack after an ownership check:

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

### Revision 1: fresh review corrections

The first reviewer stopped before a verdict. A fresh review returned FIX-FIRST with four findings, and the parent reproduced each one on the owned stack. The original results above were valid but did not prove completeness, because these false matches existed. They are fixed here, not accepted as limits.

Private evidence: `/var/folders/4d/px4017t53z7dx66qvy4fcvx00000gn/T/chooselife-003-2r1-private.0RgTC2` (mode 700). It holds the developer-stack snapshots, every capture and comparison under `cap/`, the probe SQL under `probes/`, and the capture and probe scripts under `bin/`.

**P1, managed security changes compared equal.** `managed_grants` kept only grants whose grantor was the database owner. The parent showed that revoking `EXECUTE` on `storage.foldername(text)` from `PUBLIC`, `anon`, `authenticated` and `service_role`, and disabling RLS on `storage.objects`, both produced an empty comparison. `managed_security` replaces it. It records every platform object's and extension member's owner, full ACL, API-role effective privileges, RLS enabled/forced, definer flag, `proconfig` and per-column ACLs with effective column privileges. Because it records whole ACLs and effective privileges, a revoke that removes the last grant still shows. Extension members are folded per extension as described under Scope. Schema ACLs were already under `schemas`. No platform body or definition is read.

**P2, scope depended on object owner.** The parent created `gis.__catalog_parity_probe()` owned by `supabase_admin`. `gis` is an application schema owned by `postgres`, yet the comparison was empty. Original rules: every non-extension object in `public`; elsewhere, objects owned by the database owner; triggers only on included tables or calling a database-owner function; policies on non-extension tables; event triggers, default ACLs and publications filtered by owner or `public`. A custom webhook trigger on `auth.users` calling `supabase_functions.http_request` matched none of those trigger rules. The revised rules are under Scope: application schemas are chosen by schema owner, and application objects in them are kept whatever their owner, with the owner compared. Policies, triggers, rules, event triggers, default ACLs and publications are captured everywhere.

**P2, record validation checked only `id`.** The reviewer reduced every record to `{id}` and the comparator accepted it; a string `security_definer` was accepted too. `validateCatalog` now checks each section against a declared shape matching `catalog.sql` exactly. Every field is required, with no extra fields. Types and nullability are checked. Digests must be 64 lowercase hex characters, and ACL entries must read `grantee:PRIVILEGE[*]`. `effective` must have exactly the three API roles with unique privilege lists. Column, attribute, ACL, role, event and enum label lists must have unique entries. Managed entries must carry their kind's security fields (RLS flags and columns for relations, definer flag and settings for functions). Counts and environment must have exact keys. Errors name the section, identity and field, never the value. It uses plain predicates, with no new dependency.

**P2, wrappers did not fail closed.** A valid connector block followed by a truncated second opening block was accepted, and so was a stream-json result followed by an error event. Connector text now needs exactly two standalone tag lines: one opening tag and its matching closing tag. Preamble sentences that mention the tag inline are still allowed. Stream-json is rejected on any `{"type":"error"}` event or `{"type":"log","level":"error"}` line, even when a result exists. The pinned CLI binary's stream formatter emits `log` (info, warn, success, error), `progress` (start, active, done), `result` and `error`. Log and progress lines at non-error levels are still accepted.

#### Revision 1 verification

| Command | Result |
| --- | --- |
| `node --test scripts/check-database-catalog.test.mjs` | exit 0, 75/75 |
| `node --test scripts/check-database-catalog.test.mjs scripts/verify-database.test.mjs` | exit 0, 114/114 (39 helper tests unchanged) |
| `node_modules/.bin/prettier --check scripts/check-database-catalog.mjs scripts/check-database-catalog.test.mjs` (3.8.1) | exit 0 after `--write` |
| Mutation check: a temp copy with shape validation, tag pairing and error-event rejection disabled | 25 of 75 tests fail: every new record-shape, tag-pairing and error-event case. The extra-count-key and missing-environment-field cases still pass, because they use the count and environment checks left in place |

What changed in the tests:

- The fixture now has the complete shape `catalog.sql` emits for every section, built from synthetic metadata only.
- New detection cases, with exact messages: a managed `EXECUTE` revoke that removes every grant, a managed RLS flip with table and column grant changes, an extension-wide grant change, a custom `auth.users` webhook trigger, and an application-object owner change.
- 20 malformed-record cases each exit 2:
  - every record reduced to `{id}`
  - a missing or string `security_definer`
  - missing `effective`, or `effective` missing an API role or with an extra one
  - a non-boolean `rls_enabled`
  - a managed table without RLS flags, or a managed function without its definer flag
  - an unknown managed kind
  - a malformed extension security state
  - duplicate column names, plain or managed
  - a duplicate or malformed ACL entry
  - a non-hex digest
  - an unexpected field
  - a numeric cron schedule
  - an extra count key
  - a missing environment field
- A rejected record names the field, not its value. A secret-looking fixture string is absent from the message.
- Wrapper cases:
  - accepted: real log and progress events around a result
  - rejected: a truncated second connector block, a stray closing tag, a result followed by an error event, and an error-level log
- `main` exits 2 when one side has `{id}`-only function records.

Live checks. `assertOwnedWorkspace({root, projectId})` passed before every capture, transaction and the reset. Captures used the same CLI command as before. Each probe ran as `supabase_admin` through `docker exec -i supabase_db_chooselife-verify-049997ac2680 psql -X -q -At` in a single `begin; <probe>; <catalog.sql>; rollback;` session with `ON_ERROR_STOP`. Probe output was discarded; only the catalog row was kept.

| Check | Result |
| --- | --- |
| CLI capture of the retained stack | exit 0, sha256 `b528b488…e885`, 408 KB compact |
| `psql` baseline in a rolled-back transaction | equal to the CLI capture, exit 0 |
| `revoke execute on function storage.foldername(text) from public, anon, authenticated, service_role` | exit 1, 4 lines: `managed_security function storage.foldername(name text)` `acl` loses `PUBLIC:EXECUTE`, and each API role's `effective` loses `EXECUTE` |
| `alter table storage.objects disable row level security` | exit 1, `managed_security relation storage.objects: rls_enabled: differs` |
| `grant select on auth.audit_log_entries to anon` | exit 1, `acl` and `effective.anon` gain `SELECT` |
| `grant select (email) on auth.users to anon` | exit 1, `managed_security relation auth.users: columns: … only in right: email` |
| `create function gis.__catalog_parity_probe()`, owned by `supabase_admin` | exit 1, `functions gis.__catalog_parity_probe(): only in right` |
| `create trigger catalog_parity_probe_webhook after insert on auth.users … execute function supabase_functions.http_request(<fixture URL>, 'POST', <fixture headers with a fake bearer value>, '{}', '1000')` | exit 1, `triggers auth.users.catalog_parity_probe_webhook: only in right`. No row was inserted, so no HTTP call happened. The capture holds only the function identity and a definition digest |
| `revoke execute on function extensions.st_area(extensions.geometry) from public` | exit 1, `managed_security function extensions.st_area(extensions.geometry): only in right` |
| `revoke execute on all functions in schema extensions from public` | exit 1, 61 lines naming each affected extension's `routine_security`, each application helper in `extensions`, and each changed postgis or `pg_stat_statements` exception |
| The ten original Step 2 mutations, again in one transaction | exit 1 with the same 10 lines as before |
| CLI capture after all probes | byte-identical to the baseline, compare exit 0 |
| `--agent yes` envelope, `--output-format stream-json` (one result line) and the capture rewrapped as connector `{result}` | each compares equal to the JSON capture, exit 0 |

A scan of every capture and comparison output for the fixture bearer value, the fixture host, `Bearer`, `sb_secret_`, `sb_publishable_` and JWT prefixes found nothing. `vault.decrypted_secrets` now appears only as a view identity in `managed_security`. Its rows are never read.

Fresh replay with the revised query. All of this ran after an ownership check:

1. `db reset --local --yes`: exit 0, 10:33:53–10:34:19 UTC. 41 history rows, `20250206202200`–`20261015013845`.
2. Capture before tools: byte-identical to the retained-stack capture, which came from the earlier replay after lint and pgTAP. Two clean replays therefore agree.
3. `db lint --local --schema public --level error --fail-on error`: exit 0, no results. Capture: identical.
4. `test db --local <workdir>/supabase/tests`: exit 0, `Files=12, Tests=371`, `Result: PASS`. Capture: identical.

The extension list is unchanged. The stricter capture added no normalization. The only value normalizations remain bucket IDs keyed by name, CRLF-to-LF before digests, and grantor omission in ACL entries. Server and extension versions are reported as environment metadata. No security fact is normalized.

Developer stack after revision 1: the 12 inspect records, volume names, network names and the history dump (41 rows, sha256 `2b6d8c03…f027`) are byte-identical to the before-snapshot. The only `docker ps` difference is the owned DB container recreated by the reset. The owned stack is retained as before: seven containers, two volumes, one network, all 41 migrations with seeds, after lint and pgTAP.

Judgments for review and for Step 3:

- `extensions` and `_realtime` are owned by `postgres` on the local image, so they count as application schemas. Their non-extension objects, the six `extensions` event-trigger helpers and the four `_realtime` tables, are captured in full, body digests included. Staging may run different platform versions of these helpers, or no `_realtime` tables. Step 3 should name any such difference as platform drift and investigate it, not normalize it away.
- Platform triggers, policies on `cron` tables, platform event triggers and platform default ACL rows are compared because they cannot be told apart from custom ones by catalog provenance. Platform-version differences there will appear by name in Step 3.
- `managed_security` and the folded extension states follow platform versions. A different storage, auth or realtime release on staging can add or remove platform functions and tables. Those appear as named `only in` lines.

### Revision 2: second fresh review corrections

The second fresh review confirmed the revision 1 fixes and accepted extension folding within its documented scope. It returned FIX-FIRST with two P2 input-validation findings, both reproduced by the parent and the reviewer. Only the checker, its tests and these notes changed. `catalog.sql` and every other file are unchanged, so no database replay or probe was repeated.

**P2, folded routine states accepted null security fields.** `extensions.routine_security` and `type_security` used the shared `SECURITY_STATE` record, whose kind-specific fields are all nullable. A real v2 capture with `routine_security.security_definer` or `.config` set to null was accepted, though `catalog.sql` always emits a boolean and an array for a routine state. The kind check that `managed_security` used is now `checkKindFields(state, kind, prefix, fail)`. Managed entries call it with the kind from their identity. A non-null `routine_security` is checked as `function`: definer flag and settings required, RLS flags and columns null. A non-null `type_security` is checked as `type`: all four null. A wholly null state is still accepted, as `catalog.sql` emits it when an extension has no routines or types (`plpgsql` has neither; only `pg_net` and `postgis` have a type state locally). Errors name the extension and the nested field, such as `extensions entry pg_cron has a malformed routine_security.config for its kind`. The unknown-kind check now uses `Object.hasOwn`, so an identity such as `constructor …` cannot match an inherited key.

**P2, a partial tag after a valid connector block was ignored.** The parser matched only complete tags on their own line. A valid block followed by a standalone `<untrusted-data-deadbeef` without `>` compared equal. Connector parsing now starts whenever `<untrusted-data-` or `</untrusted-data-` appears anywhere. It rejects the input unless every occurrence begins a complete tag, every line that starts with a tag is a delimiter line by itself, and there are exactly two delimiter lines forming a matching pair. The preamble and trailing sentences that name the complete tag inline are still accepted. This is a tag-prefix check, not a general markup parser.

#### Revision 2 verification

| Command | Result |
| --- | --- |
| `node --test scripts/check-database-catalog.test.mjs scripts/verify-database.test.mjs` (Node 24.18.0) | exit 0, 124/124: 85 catalog tests, 39 helper tests unchanged |
| The new catalog tests against the revision 1 checker (`git show HEAD:…`) | 9 fail: the 8 new rejection cases and the folded-state message test. The other 76 pass, including the new accepted type-state case |
| `pnpm exec prettier --check` on both scripts (pnpm 11.10.0) | exit 0 |
| `git diff --check` | exit 0 |

New tests:

- Rejected with exit 2:
  - a folded routine state with a null definer flag
  - a folded routine state with null settings
  - a folded routine state with RLS flags
  - a folded type state with a definer flag
  - a valid connector block followed by a partial opening tag line
  - a valid block followed by a partial closing tag line
  - a valid block followed by a tag line with trailing text
  - a partial tag inside the trailing prose
- Accepted: a folded type state with its ACL and every kind field null.
- A rejected folded state names `pg_cron` and `routine_security.config`.

Checks against real captures, private evidence in `/var/folders/4d/px4017t53z7dx66qvy4fcvx00000gn/T/chooselife-003-2r2-private.CK2hmz` (mode 700):

| Check | Result |
| --- | --- |
| The parent's real v2 baseline against itself | exit 0, `Application catalogs match.` |
| The baseline rewrapped as bare, CLI rows (parsed and text jsonb), agent envelope, stream-json with a warn log, connector text and connector `{result}`, each against the baseline | exit 0 each |
| Folded states in the real baseline | 10 of 11 extensions have a routine state, all with a boolean definer flag, a settings array and null RLS flags and columns. `plpgsql` has neither state. The `pg_net` and `postgis` type states have every kind field null |
| Real baseline mutated: `pg_cron` routine definer null, settings null, `rls_enabled` set, `rls_forced` set to a fixture bearer string; `pg_net` type definer set, settings set | exit 2 each, naming the extension and nested field |
| Real connector text plus a standalone partial opening tag, a partial closing tag, a tag line followed by a fixture URL, a partial tag in prose, and the partial opening tag inside connector `{result}` | exit 2 each, `Input needs exactly one matching pair of untrusted-data tag lines.` |
| The bad-input messages scanned for the fixture bearer, fixture host and `Bearer` | none found |
| All 20 saved revision 1 captures against the baseline | none exit 2. The 11 steady-state captures exit 0, including fresh, before tools, after lint, after pgTAP, after probes, the agent envelope, stream-json and connector shapes. The 9 probe captures exit 1, as before |

### Recovery: opaque payload strings in connector and stream wrappers

The third fresh review agreed with the revision 2 folded-state fix and found no other material SQL issue. It found one P2 regression from revision 2. The tag-prefix check scanned the whole input, including strings inside the JSON payload. A real baseline with `schemas[0].comment` (`_realtime`) set to `Documentation example: <untrusted-data-deadbeef` was valid as bare JSON and compared equal to itself. The same payload in connector text, connector `{result}` or stream-json exited 2, because the comment was read as connector protocol. The parent and the reviewer both reproduced it. The two-revision loop was closed as BLOCKED, and the plan's wrapper contract was refined in `83ad81e`. This is the one bounded recovery that contract allows. Only the checker, its tests and these notes changed. `catalog.sql` is unchanged, so the revision 1 live results stand and no database action was taken.

**Fix.** `parseText` now decides the format before it looks for any tag:

1. The whole input parses as one JSON document: bare catalog, CLI rows, agent envelope, connector `{result}` or a one-line stream-json result. Unchanged.
2. Every non-empty line parses as JSON, with at least two lines: stream-json. The error-event, error-log and one-result rules are unchanged. Log messages and result data are never scanned for tags.
3. Otherwise connector text. The two standalone tag lines are found first and must form one matching open/close pair. The partial-tag, tag-at-line-start and inline-complete-tag checks then run only on the prose outside that pair. Only the text between the lines is parsed as JSON.

A JSON string cannot hold a raw line break, so no payload value can form a standalone tag line. A payload that tries to end the block with an escaped `\n</untrusted-data-…>\n` stays inside its string. Text with no standalone tag lines that is neither JSON nor JSON lines exits 2 with `Input is not valid JSON.` That includes truncated stream-json. Previously that message was `A stream-json line is not valid JSON.`

#### Recovery verification

| Command | Result |
| --- | --- |
| `node --test scripts/check-database-catalog.test.mjs scripts/verify-database.test.mjs` (Node 24.18.0) | exit 0, 176/176: 137 catalog tests (85 previous plus 52 new), 39 helper tests unchanged |
| The new catalog tests against the `83ad81e` checker (`git show HEAD:…`) | 16 of 137 fail: the new stream-json wrapper with tag-like log text, 14 cross-wrapper payload cases (every multi-line stream-json case, and the partial-tag cases in connector text and `{result}`), and the cross-wrapper equality test. All 85 previous tests and the 5 new rejection cases pass. Complete tags and escaped tag lines inside connector payloads already passed |
| `node_modules/.bin/prettier --check` on both scripts | exit 0 |
| `git diff --check` | exit 0 |

New tests:

- One wrapper: stream-json whose info and warn logs contain a complete connector tag and a partial tag.
- Accepted in each of the nine wrappers (bare, CLI rows parsed and as text, agent envelope, three stream-json variants, connector text, connector `{result}`), each round-tripping deep-equal: the schema comment, a column default and a function setting all hold one of five tag-like values. Those values are a partial opening tag, a partial closing tag, the complete connector opening tag, its closing tag, and an escaped newline-framed close/open pair. 45 cases.
- The partial-opening-tag payload compares equal across all nine wrappers.
- Rejected with exit 2: a stream-json error whose message looks like a tag; stream-json followed by a standalone partial tag line; a partial tag in connector preamble with a tag-like payload; a valid block with a tag-like payload followed by a standalone partial closing tag; a payload rewritten so its string breaks into real close/open tag lines.

Checks against the real baseline, private evidence in `/var/folders/4d/px4017t53z7dx66qvy4fcvx00000gn/T/chooselife-003-2r3-private.ZuimSIiolm` (mode 700):

| Check | Result |
| --- | --- |
| The parent's real v2 baseline against itself | exit 0 |
| The baseline with the reproduced `_realtime` comment, rewrapped as bare, CLI rows (pretty, parsed), CLI rows (jsonb as text), agent envelope, stream-json with tag-like info and warn logs, connector text and connector `{result}` | each extracts deep-equal to the mutated payload. Each against the bare mutated file exits 0. Each against the original baseline exits 1 with the single line `schemas _realtime: comment: differs` |
| The same seven files through the `83ad81e` checker | bare, rows, rows-text and envelope exit 0. Connector text, connector `{result}` and stream-json exit 2. This matches the parent's reproduction |
| The mutated real payload in connector text plus a standalone partial opening tag, partial closing tag, tag line with a fixture URL, partial tag in prose, stray closing tag, second block, truncated second block and mismatched closing tag. Also the partial opening tag inside `{result}` | exit 2 each, `Input needs exactly one matching pair of untrusted-data tag lines.` |
| The mutated real payload as stream-json with an error event, with an error-level log, and truncated; bare JSON truncated | exit 2 each |
| Real folded-state mutations inside connector text: `pg_cron` definer null, settings null, `rls_forced` set to a fixture bearer string; `pg_net` type definer set | exit 2 each, naming the extension and field |
| All checker output scanned for the fixture bearer and host, `Bearer`, `deadbeef` and `Documentation example` | none found |
| All 20 saved revision 1 captures against the baseline | 11 steady-state captures exit 0, 9 probe captures exit 1, none exit 2. Same as revision 2 |
| The 18 saved revision 2 wrapper and bad-input files against the baseline | the 7 wrappers exit 0, the 11 bad inputs exit 2. Same as revision 2 |

Exact limits of this recovery:

- The connector delimiter is still recognized by the `untrusted-data-<hex/dash id>` tag shape seen in the connector's current output, on its own line. The live connector path remains untested here, because there is no cloud access in this checkpoint.
- A stream is identified by every line parsing as JSON. Connector tag lines are never JSON, so connector text cannot be taken for a stream. Text mixing JSON lines with other lines and no tag pair exits 2.
- Payload strings are only treated as data. The checker never evaluates them, and reports name fields, not values.
- The recovery has not been reviewed. Step 2 is not accepted.

### Known limits

- ACL entries omit grantors, so a privilege granted by two grantors is one entry. A revoke by one of them changes nothing effective and is not reported. Any change to who holds a privilege, or to effective privileges, is reported.
- Platform objects carry only security state. A platform function body, table definition, index or constraint is not compared. In hosted projects the migration role cannot change those because it does not own them. A superuser change would show only through owner, ACL, RLS, definer or settings. Platform triggers and policies are compared fully.
- Extension members in their extension's common state are folded. For a fixed member set, the common state and the named exceptions preserve the whole security distribution: any member that leaves the common state is listed by name, and any change to the common state is reported on the extension. Members added or removed while sharing the common state are outside the inventory, in the same way that extension implementation objects are excluded and versions are reported only as metadata. No member identity list or hash is kept.
- Policies, triggers and the other captured-everywhere objects are not marked as platform or application. The stage comparison names them all the same way.
- Not captured: roles and memberships (which also affect effective privileges), language, large-object, foreign-server and database ACLs, objects in `pg_catalog` and `information_schema`, casts, operators and operator classes, statistics objects, collations, text search configuration, Auth settings outside the database, vault secrets (by design) and stored objects.
- Deparsed definitions come from the server. A different Postgres major on staging could print equivalent SQL differently; that would show as named differences, not be hidden. Formatting is not normalized beyond CRLF.
- The query requires Postgres 15+ catalogs (`prattrs`, `pg_publication_namespace`), `cron.job` and `storage.buckets`. If one is missing it errors instead of returning a partial result. A missing API role makes the capture fail validation.
- A role that neither is superuser nor has `BYPASSRLS` would see RLS-filtered `cron.job` and `storage.buckets` rows. The comparator rejects such a capture rather than trusting it.
- The live connector path and its size limits are untested, because this checkpoint has no cloud access. The compact payload is about 408 KB; the CLI's pretty JSON is about 694 KB.

## Deviations

- Plan text says the companion RPCs are `register_festival_companion_installation` and `unregister_festival_companion_installation`. The migration `supabase/migrations/20260730140837_festival_live_companion.sql:65` defines `register_festival_companion_token(installation_id_input uuid, token_type_input text, activity_name_input text, token_input text, language_input language)`, and `:139` defines `unregister_festival_companion_installation(uuid)`. No `register_festival_companion_installation` exists in the migrations, the replay, or any tracked source. Step 4's `rg` identity check should use `register_festival_companion_token`. Otherwise it cannot find all five identities from a correct full regeneration. This is a plan correction, not a schema difference. Neither function is in the current tracked type artifact.
- The plan expected the developer database to differ from the checked-in history only by `profile_isa_accounts`. The history comparison shows both have the same 41 versions and names (identical sha256), so that object exists in the developer DB without any migration record. I did not inspect the developer schema to confirm the object itself.
- The compiler baseline fails in web and mobile before any type change. Recorded above. Nothing was fixed.
- Inventory queries passed SQL as the positional argument with `--output json` and `--agent no`. Step 3's `--file` form is unchanged and will be checked when `catalog.sql` exists.
- The worktree was not based on the parent's current `HEAD` `b793adf` (`refactor(webbing): clear React Doctor issues in the catalog picker`). That commit is not an ancestor of this branch. The compiler baseline therefore reflects `abd5a18`, not the parent checkout.
- Step 2 adds a `storage_buckets` section that the plan's list does not name. Bucket rows are platform configuration, not user data, and `public` controls anonymous reads. Buckets are keyed by name because a migration assigns random IDs (see Step 2). This is the only value normalization besides CRLF.
- Step 2 treats extension presence and schema placement as application semantics and only extension versions as environment metadata. The plan lists all three as environment metadata; a missing extension would break application functions, so it is not reported as harmless.
- Step 2 sets `search_path` to empty for the query's own transaction with `set_config`. That is the one statement-level side effect in an otherwise read-only query. Without it, identities and definitions depend on the client.
- Step 2 revision 1 adds a `managed_security` section in place of `managed_grants`, and extension security entries, with format `chooselife.catalog.v2`. The plan excludes platform objects from application comparison. Their security state is still compared, because the plan also requires managed-schema privilege differences to be found.
- Step 2 revision 1 counts every non-extension schema owned by the database owner as an application schema. Locally that includes `extensions` and `_realtime`, which the platform creates. See the revision 1 judgments.
- Step 2 found no verification-only extension or helper to exclude. The plan anticipated some. The pre-tool and post-tool captures are equal, so the query has no provenance exclusion.
- Step 3 ran no hosted command. The plan allows the connector or `db query --linked`. This checkpoint used the root's connector captures of `get_project`, `list_migrations` and `execute_sql`, which ran the unchanged `catalog.sql`. Hosted access was the root's bridge; no credential, link or `.temp` file was used in the owned workspace.
- Step 3's same-version comparison exits 1, not 0. The plan accepts named blockers in that case. Two are application drift (B1 buckets, B2 `public` schema `PUBLIC:USAGE`). One is platform Vault/pgsodium security state needing owner acceptance (B3). The pinned CLI used a newer Postgres image (`15.19.0.004`) than staging (`15.8.1.044`). No same-image replay was performed. The platform groups P3–P9 are observed differences consistent with platform/service version differences; the captures do not prove every difference's historical cause. Nothing was normalized, allow-listed or edited to change the result.

## Parent final recovery review

Fresh Sol `/root/supabase_003_2_recovery_review` returned FIX-FIRST P2. JavaScript multiline anchors in `UNTRUSTED_TAG` recognize U+2028 and U+2029 inside valid JSON strings as line boundaries. A schema comment containing either character around complete connector tags parses in bare JSON but is rejected in connector text and connector `{result}`. This still violates the revised opaque-payload contract. The parent independently reproduced both variants. Evidence: `/var/folders/4d/px4017t53z7dx66qvy4fcvx00000gn/T/chooselife-parent-unicode-wrapper-ksTjiD/report.json`.

The parent passed all 176 tests, Prettier, unchanged-SQL/protected-input checks and the ASCII cross-wrapper regressions. Those tests do not cover this Unicode case. No other material issue was found in the final recovery review.

The original two-round correction loop and the single revised recovery allowance are exhausted. Root leaves 003.2 BLOCKED, does not start another correction loop, and does not push the unaccepted checkpoint. Local commits and private evidence are preserved.

The owned database `chooselife-verify-049997ac2680` was stopped and removed through `cleanupWorkspace` after ownership validation. Its workdir was removed. All 12 developer containers, their identities/start times/restarts, and the developer migration history stayed unchanged. The old retained descriptor is now historical; any future database verification must create a fresh owned workspace.

A parent metadata-only preflight confirmed the linked project is still `festival-chooselife-stage`, reference `azhdfsfdfyvrvcjkkgbq`, healthy on Postgres `15.8.1.044`. The existing connected Supabase app can read that project metadata. No staging catalog or migration comparison was performed, and no hosted write occurred. This checkpoint is blocked on the parser, not on demonstrated missing credentials.

## Resumed: physical connector framing for Unicode separators

On October 17 the user told the agent to proceed, which resumed the blocked 003.2 checkpoint for one new bounded task. The task fixes the U+2028/U+2029 regression from the parent's final recovery review, then goes to a new fresh review. Only the checker, its tests and these notes changed. `catalog.sql`, the helper, its tests and `package.json` are unchanged. No database was created or queried, because the SQL did not change.

**Cause.** `UNTRUSTED_TAG` used the `m` flag. JavaScript's multiline `^` and `$` also match at U+2028 and U+2029, as well as at a lone CR. JSON escapes LF and CR inside strings but allows raw U+2028 and U+2029, and `JSON.stringify` writes them raw. The old checker comment said a JSON string cannot hold a line break. That was true of physical LF and CR, but not of these two separators. So a schema comment holding complete tags between U+2028 or U+2029 counted as two extra tag lines in connector text and connector `{result}`.

**Fix.**

- `tagLines` splits the connector text on LF only. It matches `TAG_LINE` (no `g` or `m` flag) against one physical line at a time. A CR before the LF stays in the line and is allowed by the trailing `[ \t\r]*`, as before, so LF and CRLF framing both work. U+2028, U+2029 and a lone CR no longer end a line, so they cannot frame the data.
- The payload is the text between the two tag lines, passed to `JSON.parse` without `.trim()`. Only JSON whitespace is allowed around it. Before, `.trim()` also removed U+2028, U+2029 and other Unicode spaces at the edges of the block.
- The prose check outside the pair now uses explicit boundaries: `(?:^|[\n\r  ])[ \t]*<\/?untrusted-data-`, without `m`. Outside the data, a tag after any of these characters still fails closed, because a reader could take it for another tag line.
- The format order is unchanged: one JSON document, then JSON lines (split on LF), then connector text. JSON payload and stream log strings are never scanned for tags. Record shapes, folded-state kind checks and value-free messages are unchanged.

#### Resumed verification

| Command | Result |
| --- | --- |
| `node --test scripts/check-database-catalog.test.mjs scripts/verify-database.test.mjs` (Node 24.18.0) | exit 0, 225/225: 186 catalog tests (137 previous plus 49 new), 39 helper tests unchanged |
| `node --test scripts/check-database-catalog.test.mjs` alone | exit 0, 186/186. Before the new tests were added, the fixed checker passed the 137 previous tests unchanged |
| The 186 catalog tests against the `d36b641` checker (`git show HEAD:…`) | 15 fail. These are 10 valid U+2028/U+2029 payloads in connector text and `{result}` (LF and CRLF), both cross-wrapper Unicode tests, and 3 framing guards. The old checker accepted connector text framed only by U+2028, U+2029 or lone CRs. It also accepted a U+2028 between the opening tag line and the JSON |
| `node_modules/.bin/prettier --check` on both scripts | exit 0 |
| `git diff --check` | exit 0 |
| `git diff --quiet HEAD -- supabase scripts/verify-database.mjs scripts/verify-database.test.mjs package.json` | exit 0 |

New tests:

- Two wrappers: connector text and connector `{result}` with CRLF line ends. Every accepted-wrapper and tag-like-payload case now also runs in them (11 wrappers).
- Two tag-like values, built with `String.fromCharCode`: `Documentation:` followed by a complete closing tag and a complete opening tag, separated and ended by U+2028, and the same with U+2029. Each goes in the schema comment, a column default and a function setting. Each must round-trip deep-equal in all 11 wrappers. That is 22 cases.
- One test per separator, for the reproduced comment-only case. In every wrapper, the raw separator appears unescaped in the wrapped text. The extracted catalog is deep-equal to the input and the comment is exactly the original string. It compares equal to the bare extraction. Against the unmodified fixture it gives exactly `schemas public: comment: differs`.
- Rejected with exit 2: connector tag lines separated only by U+2028, U+2029 or lone CRs, and U+2028-only framing inside `{result}`. Also a valid block followed by a stray closing tag after U+2028, a partial tag after U+2029, and a second block after U+2028. Also a U+2028 between the opening tag line and the JSON, and a U+2028 payload broken into real LF tag lines. Also a partial tag in the preamble with a U+2029 tag-like payload. For CRLF: mismatched boundaries, two blocks, and a following partial tag line.

Checks against the parent's real v2 baseline, private evidence in `/var/folders/4d/px4017t53z7dx66qvy4fcvx00000gn/T/chooselife-003-2r4-private.oEGqEV` (mode 700). The generator is `bin/make.mjs`, the files are in `w/`, and the exits are in `results.txt`, `saved.txt` and `head-control.txt`.

| Check | Result |
| --- | --- |
| The baseline against itself | exit 0 |
| `schemas[0].comment` (`_realtime`) set to the reproduced value (`Documentation:`, separator, closing tag, separator, opening tag, separator), once for U+2028 and once for U+2029. Each is wrapped 10 ways: bare, CLI rows (pretty), rows with jsonb as text, agent envelope, stream-json with tag-like info and warn logs, stream-json with CRLF, connector text LF and CRLF, connector `{result}` LF and CRLF | 20 files. Each holds the raw separator, extracts deep-equal to the mutated payload, and keeps the comment exactly. Each exits 0 against its bare file. Each exits 1 against the original baseline with the single line `schemas _realtime: comment: differs` |
| The same 20 files through the `d36b641` checker | the 8 connector text and `{result}` files exit 2, reproducing the parent's report. The other 12 exit 1 |
| 28 new bad files from the mutated baseline (both separators). These are separator-only framing in text and `{result}`, and a stray closing tag, partial tag or second block after a separator. Also a separator between the opening tag line and the JSON. For CRLF: a partial opening tag, a tag line with a fixture URL, a stray closing tag, two blocks, mismatched boundaries, and a partial tag in `{result}`. Also stream-json with an error event and with an error-level log | exit 2 each |
| The 17 revision 2 and recovery bad files in `chooselife-003-2r3-private.ZuimSIiolm/w` | exit 2 each, as before |
| The 7 recovery wrapper files (ASCII tag-like comment) against the baseline | exit 1 each with the comment difference, as before |
| All 20 saved revision 1 captures against the baseline | 11 steady-state captures exit 0, 9 probe captures exit 1, none exit 2. `saved.txt` is byte-identical to the recovery run's |
| All checker output scanned for the fixture bearer and host, `Bearer`, `deadbeef` and `Documentation` | none found |

One generator mistake was corrected during the run. The first CRLF mismatched-boundary file replaced the first closing tag in the text, which was now the one inside the Unicode comment. The real frame stayed valid, so the checker correctly read the comment as data and exited 1. The generator now replaces the frame's closing line, and both files exit 2.

Limits of this fix:

- Framing is by LF, with an optional CR before it. Connector text that used lone CRs or Unicode separators as line ends would be rejected, not parsed. No such output has been observed.
- `parseText` still trims the whole input with `String.prototype.trim` before the format is chosen. That removes Unicode spaces and separators only at the very start and end of the input. It cannot create or hide a tag line, and the format-first logic is unchanged.
- The live connector path is still untested here, because this task has no cloud access.
- This fix has not been reviewed. Step 2 is not accepted.

## How the run ended

Step 1 is accepted. Prerequisites held: CLI 2.121.0, 39/39 helper tests, and `pnpm db:verify --keep` passing with 41/41 migrations, a clean lint and 12 files with 371 assertions. The clean replay matches the checked-in migrations exactly. It has 38 public tables and 82 public functions, and no `profile_isa_accounts`. The raw compiler baseline in a fresh worktree was web exit 1, mobile exit 1 and UI exit 0, with eight diagnostics from missing framework declarations. After the parent prepared the ignored Next and Expo declarations, all three typechecks exit 0 with no diagnostics. That prepared baseline is the one later steps compare against.

Step 2 revision 1 is done locally and waits for a new fresh review. Step 2 is not accepted. `supabase/verification/catalog.sql` returns one nonsecret `chooselife.catalog.v2` JSON catalog. It includes the security state of platform objects and extension members, application objects of any owner in application schemas, and triggers, policies and publications wherever they are. `pnpm db:catalog:compare` validates every record's complete shape and both wrappers fail closed. It exits 0, 1 or 2. 75 catalog tests pass beside the 39 existing ones. The parent's managed `EXECUTE` revoke, managed RLS flip and non-owner `gis` function are detected live, along with a managed table grant, a managed column grant, a custom `auth.users` webhook trigger and extension grant changes. Every probe rolled back to a byte-identical capture. Two clean replays compare equal, and lint and pgTAP leave no catalog residue. The developer `chooselife` stack is unchanged. The owned stack `chooselife-verify-049997ac2680` is retained at `/private/var/folders/4d/px4017t53z7dx66qvy4fcvx00000gn/T/chooselife-verify-QD2JDJ`, in full migrations-plus-seeds state, for Step 3.

Step 2 revision 2 changes only the checker, its tests and these notes. It answers the second fresh review's two P2 findings. Folded extension states must have their kind's fields, and partial or extra connector tags are rejected. 85 catalog tests pass beside the 39 helper tests. The real baseline still parses and matches itself in every wrapper. The saved revision 1 captures compare as before, and the new bad inputs exit 2 without printing values. `catalog.sql` is unchanged, so the revision 1 live results stand. Revision 2 waits for a new fresh review. Step 2 is not accepted. The owned stack is untouched by this revision.

The Step 2 parser recovery changes only the checker, its tests and these notes. It answers the third fresh review's P2 regression. Payload strings stay opaque in every wrapper, and connector tags are only interpreted outside the framed JSON block. 137 catalog tests pass beside the 39 helper tests. The real baseline with the reproduced tag-like schema comment round-trips unchanged and compares exit 0 in bare JSON, CLI rows, the agent envelope, stream-json, connector text and connector `{result}`. Every earlier rejection still exits 2 without printing values, and the saved captures compare as before. This is the single bounded recovery the refined contract allows. It waits for a new fresh review. Step 2 is not accepted. The owned stack was not touched.

Steps 3–5 have not started. No staging inspection, versioned reset, type regeneration, route change, runner integration, workflow or README change happened. Plan 003 is not done.

Final root status: 003.2 remains BLOCKED by the valid Unicode payload regression described above. The disposable database has been removed. The last accepted remote checkpoint remains `6481a036524a872e17a8aedd94709654def0f5e2`; subsequent implementation commits remain local and unaccepted. The metadata-only parent staging preflight is the exception to the earlier no-staging-access statement; no schema comparison has run.

Resumed under the user's October 17 instruction to proceed: the bounded Unicode framing fix changes only the checker, its tests and these notes. Connector tag lines are found on physical LF/CRLF lines, so raw U+2028 and U+2029 in payload strings stay data. 186 catalog tests pass beside the 39 helper tests. The real baseline with the reproduced comment round-trips unchanged in all ten wrappers for both separators. Each compares exit 0 to its bare form and exit 1, comment only, to the original. Every earlier rejection and the new framing guards exit 2 without printing values. The saved captures compare as before. No database was used. The fix awaits a new fresh review; 003.2 is not accepted and nothing was pushed.

Step 3 (checkpoint 003.3) is STOPPED with named blockers and is not accepted. Staging `festival-chooselife-stage` has 40 migrations, an exact prefix of the 41 checked-in ones. The pending `20261015013845` accounts for exactly four catalog lines, so the deployment lag is documented. The owned replay at `20261014162921` matches the captured `public` and `gis` object definitions, policies, triggers, cron jobs and Realtime application tables. Application configuration still differs in B1 bucket settings and B2 schema `public` ACL; no full application parity is claimed. The comparator still exits 1 with 217 lines. Two of them are application drift: B1, Storage bucket configuration (a public staging-only `webbings` bucket and different MIME rules), and B2, `PUBLIC:USAGE` revoked on schema `public` on staging only. B3 is the pgsodium and Vault 0.2.8 security state on staging, which needs owner acceptance. P3–P9 are documented platform image and service differences. Two minimal read-only diagnostic queries are proposed for the root. The owned stack `chooselife-verify-fb3593e92268` is retained in its full 41-migration seeded state. Lint passes, and pgTAP passes 12 files and 371 assertions. The developer stack is unchanged. Production was not inspected. Steps 4–5 have not started, and Plan 003 is not done.


## Parent acceptance of003.2

Root accepts003.2 at `0cb874fb60cc59fd01c76315b6026e9c5fda21c2` after the user-authorized resumed task. Fresh GPT-6.1-Sol High reviewer `/root/supabase_003_2_unicode_review` returned SHIP with no material findings. Root independently passed225catalog/helper tests,28real-baseline Unicode wrapper round-trips,16outer-boundary negatives,45saved invalid-file CLI rejections and20saved captures with11equal/9semantic differences. Reviewer independently passed225tests,22real-baseline round-trips and14malformed frames; it judged the helper and offsets simple enough. Prettier, scope and whitespace checks passed. No SQL or database operation changed during this task. Parent report: `/tmp/chooselife-parent-unicode-accepted-1nb3XB/report.json`. Earlier BLOCKED paragraphs above are historical;003.2 is now accepted. Live connector execution and staging parity remain due003.3.

## Step 3: same-version staging comparison

Status: STOPPED with named blockers. Not accepted. The comparison ran on real captures from both sides, and the owned database was restored and verified afterwards. This checkpoint changed only this notes file. No source, SQL, checker, test, migration, seed, config, generated type, route, README or workflow changed. No hosted operation ran in this checkpoint. The hosted half is the root's read-only connector capture (below).

Private evidence: `/var/folders/4d/px4017t53z7dx66qvy4fcvx00000gn/T/chooselife-003-3-private.pVUMoK` (mode 700). It holds `descriptor.json`, the developer snapshots under `snap/before|after`, every local capture under `cap/`, comparator output and the classification under `cmp/`, command logs under `logs/`, and the scripts under `bin/` (`snapshot.sh`, `assert-owned.mjs`, `history.py`, `show.mjs`, `classify.py`). `show.mjs` redacts every digest, comment, default, definition and command field, and `config` values. A scan for `sb_secret_`, `sb_publishable_`, JWTs, `Bearer` tokens and URL passwords found nothing.

Commands ran under Node 24.18.0 from nvm, pnpm 11.10.0 and repository CLI 2.121.0. `HEAD` was `09b44c2` with a clean status before work. No `SUPABASE*`, `PG*`, `DATABASE*` or `DOCKER*` variable was set in the shell.

### Owned replay

| Command | Exit | Result |
| --- | --- | --- |
| `pnpm db:verify --keep` (12:42:35–12:43:36 UTC) | 0 | `chooselife-verify-fb3593e92268`, 41 migrations, 12 test files, `41 versions match 41 files`, lint ok, pgTAP `12 files, 371 assertions` |
| `node bin/assert-owned.mjs descriptor.json` (calls the repository's `assertOwnedWorkspace`) | 0 | Ran before every reset, query batch and test run below |

Retained descriptor, with no credentials:

```json
{
  "path": "/private/var/folders/4d/px4017t53z7dx66qvy4fcvx00000gn/T/chooselife-verify-UCnOyZ",
  "projectId": "chooselife-verify-fb3593e92268",
  "ports": { "api.port": 60329, "db.port": 60330, "db.shadow_port": 60331, "db.pooler.port": 60332, "studio.port": 60333, "inbucket.port": 60334, "edge_runtime.inspector_port": 60335, "analytics.port": 60336 },
  "cleanup": "'/Users/juangsandrade/.t3/worktrees/chooselife/t3-f4bb91a0/node_modules/.bin/supabase' --workdir '/private/var/folders/4d/px4017t53z7dx66qvy4fcvx00000gn/T/chooselife-verify-UCnOyZ' stop --project-id chooselife-verify-fb3593e92268 --no-backup && rm -rf '/private/var/folders/4d/px4017t53z7dx66qvy4fcvx00000gn/T/chooselife-verify-UCnOyZ'"
}
```

The workdir's `.temp` holds only `cli-latest`. It has no `project-ref`, link or env file, and nothing was copied from the parent's `supabase/.temp`. The owned DB image is `postgres:15.19.0.004`. Staging runs `15.8.1.044`.

### Pinned CLI interface

`supabase --agent no db reset --help` (exit 0) lists `--local`, `--linked`, `--db-url`, `--version`, `--last`, `--no-seed` and `--sql-paths`. `supabase --agent no db query --help` (exit 0) lists `--local`, `--linked`, `--db-url`, `--project-ref` and `--file/-f`, with the global `--output` and `--workdir`. Both match Step 2.

### Hosted captures and history prefix

The root supplied the captures in `/var/folders/4d/px4017t53z7dx66qvy4fcvx00000gn/T/chooselife-stage-catalog-x8n_53_a`. They are treated as data only. sha256 prefixes: `project-tool.json` `bfee02cbeb352683`, `migrations-tool.json` `9f3198c6128966ab`, `migrations.txt` `51536dc58a304161`, `catalog-tool.json` `89af52d8dd2e709b`, `catalog.txt` `05a7c7d0aa4e081e`, `catalog.normalized.json` `0526cfe0ccb4e7bc`.

- `project-tool.json`: name `festival-chooselife-stage`, `ACTIVE_HEALTHY`, `sa-east-1`, database `15.8.1.044`. Its reference equals the parent's `supabase/.temp/project-ref`, which was used as identification only.
- `bin/history.py`: the `migrations.txt` list equals the list inside `migrations-tool.json`. It has 40 sorted, unique versions, `20250206202200`–`20261014162921`. These equal the first 40 checked-in filename prefixes, and all 40 names match. No remote version is unknown. The one local-only version is `20261015013845` (`webbing_catalog_snapshot`). This is a matching prefix, so the STOP condition does not apply.
- `catalog-tool.json` is one text item, `isError: false`, 484,197 characters. `catalog.txt` equals that text plus a trailing newline. That is 484,200 bytes, because some characters are multi-byte. `catalog.txt`, `catalog.normalized.json` and the tool text rewrapped as connector `{result}` all compare exit 0 against `catalog.normalized.json`. Stage `complete_visibility` is true, and `app_owner` is `postgres`.

### Versioned reset and same-version capture

| Command | Exit | Result |
| --- | --- | --- |
| `supabase --workdir "$W" --agent no db reset --local --version 20261014162921 --no-seed --yes` (12:44:15–12:44:41 UTC) | 0 | 40 `Applying migration` lines, `Seeding globals from roles.sql` (roles, not data), no `Seeding data` line |
| `db query --local --output json "select version, name from supabase_migrations.schema_migrations …"` | 0 | 40 rows, `(version, name)` equal to staging's list |
| `db query --local --output json` on `pg_extension` | 0 | Clean-reset extensions before any tool: `pg_cron 1.6.4`, `pg_graphql 1.6.2`, `pg_net 0.20.4`, `pg_stat_statements 1.10`, `pgcrypto 1.3`, `pgjwt 0.2.0`, `plpgsql 1.0`, `postgis 3.3.2`, `supabase_vault 0.3.1`, `unaccent 1.1`, `uuid-ossp 1.1` |
| `supabase --workdir "$W" --agent no db query --local --file "$PWD/supabase/verification/catalog.sql" --output json`, twice | 0, 0 | 691,684 bytes each, byte-identical (sha256 `c12ba4504cbad00c…`). Self-compare exit 0 |

`supabase/verification/catalog.sql` is unchanged since `d67f226` (sha256 `6913fc91…0fc7`), and the workdir copy is byte-identical. Lint and pgTAP did not run between this reset and these captures.

### Comparison

`pnpm db:catalog:compare cap/local-stage-a.json <captures>/catalog.txt` exits **1** with 217 differences. The same 217 lines come from the comparison against `catalog.normalized.json`. The only extra output is pnpm's lifecycle line. Counts, local vs stage:

| Section | Local | Stage | Section | Local | Stage |
| --- | --- | --- | --- | --- | --- |
| schemas | 15 | 16 | policies | 68 | 68 |
| relations | 51 | 47 | triggers | 39 | 40 |
| constraints | 186 | 179 | rules | 3 | 3 |
| indexes | 116 | 108 | event_triggers | 8 | 9 |
| types | 21 | 21 | default_acls | 30 | 35 |
| functions | 88 | 88 | managed_security | 137 | 236 |
| extensions | 11 | 12 | publications / tables | 1 / 4 | 2 / 5 |
| cron_jobs | 3 | 3 | storage_buckets | 4 | 5 |

The relation, constraint and index surplus is exactly the 4 tables, 7 constraints and 8 indexes of `_realtime`.

**No difference** appears in any `public` or `gis` relation, column, constraint, index, type, function, policy, trigger, rule, RLS flag, replica identity, ACL or effective privilege. None appears in the `supabase_realtime` publication tables, the three cron jobs, default ACLs owned by `postgres`, the custom `auth.users` trigger, or any `storage.objects` policy. Differences appear only in `functions` entries in `extensions`. At 40 versions, those application object definitions match the clean replay. B1 bucket configuration and B2 schema `public` ACL remain application differences; this is not full application parity.

Environment metadata does not change the exit code: server `150019` vs `150008`, `pg_cron` 1.6.4 vs 1.6, `pg_graphql` 1.6.2 vs 1.5.11, `pg_net` 0.20.4 vs 0.14.0, `postgis` 3.3.2 vs 3.3.7, `supabase_vault` 0.3.1 vs 0.2.8.

`bin/classify.py` assigns each of the 217 lines to one group. No line is unclassified. "Left" is the local replay and "right" is staging.

#### Application drift, blocking

- **B1, storage buckets (7 lines).** `20250407023808_buckets.sql` inserts `images`, `avatars` and `promo` with `gen_random_uuid()` IDs, `public = true` and `allowed_mime_types = ARRAY['image/jpeg, image/png, image/webp']`: one comma-joined element. Each insert runs only `IF NOT EXISTS (… WHERE name = …)`. On staging, all three have `id = name`. The root's subsequent bucket metadata query records creation dates before the April 7, 2025 migration: `images` July 19, 2023; `avatars` February 6, 2025; `promo` April 3, 2025. These timestamps support the inference that the migration skipped pre-existing buckets; IDs alone do not establish history, and catalog timestamps are not an immutable audit trail. Their MIME rules differ: `avatars` is `image/*`, `images` is the three types as separate elements, and `promo` is null (unrestricted). Locally all three get the single comma-joined element. That element is probably not a valid MIME match, which is a separate defect for the migration owner. Staging also has a **public** bucket, `webbings` (`id = name`, no size or MIME limit), that no migration creates. `20261014162921_webbing_personal_photos.sql:1` says personal photos use the R2 `webbings` bucket, not Supabase Storage. `public` and `file_size_limit` agree for the three shared buckets, and `documents` matches. The bucket set and its upload rules are application configuration that a replay does not reproduce. The root ran `select name, created_at, updated_at from storage.buckets order by name;` after the first review. Creation and update timestamps are equal for these buckets. `webbings` records April 10, 2025, and `documents` November 27, 2025. This reads bucket configuration metadata only, no objects; it does not establish every historical configuration change.
- **B2, `public` schema ACL (1 line).** Locally `PUBLIC:USAGE` is present. That is the Postgres 15 default, through `pg_database_owner`. On staging it has been revoked. No checked-in migration explicitly grants or revokes the `PUBLIC` role's access to schema `public`. The baseline migration explicitly grants `USAGE` to `postgres`, `anon`, `authenticated` and `service_role` at lines521–524; those grants are preserved. Effective `USAGE` for `anon`, `authenticated` and `service_role` is identical, because each has an explicit grant. The difference can affect roles that lack another effective `USAGE` grant; ownership or explicit/inherited grants can preserve access. It is a security-relevant grant on an application schema, and a replay does not reproduce it. Postgres keeps no grant history, so no catalog query on staging can say whether a platform default or a manual revoke caused it. The owner must decide whether to codify the revoke in a migration or accept local `PUBLIC:USAGE`. That is not resolved here.

#### Platform-provisioned, security-relevant, owner acceptance required (blocking until accepted)

- **B3, pgsodium and the pgsodium-based Vault on staging (131 lines. The classifier puts 122 in its pgsodium group, three of them the Vault ACL lines that name `pgsodium_keyiduser`, and 9 in its Vault group).** Staging has the `pgsodium` extension, its schemas `pgsodium` and `pgsodium_masks`, and 6 relations: `decrypted_key`, `key`, `key_key_id_seq`, `mask_columns`, `masking_rule` and `valid_key`. It also has 98 `pgsodium.*` routines in `managed_security`. Other staging-only objects: triggers `pgsodium.key.key_encrypt_secret_trigger_raw_key` and `vault.secrets.secrets_encrypt_secret_trigger_secret`, routine `vault.secrets_encrypt_secret_secret()`, event trigger `pgsodium_trg_mask_update`, and 5 `supabase_admin` default ACLs on `pgsodium` and `pgsodium_masks`. Locally only, `vault._crypto_aead_det_{decrypt,encrypt,noncegen}` exist (Vault 0.3.1's own crypto helpers). `20250206202200_remote_schema.sql:17` records that pgsodium was removed from the replay on purpose, because the base image no longer provisions it. So this half is documented history. Vault 0.2.8 versus 0.3.1 changes security state:
  - schema `vault`: locally `postgres:USAGE*` and `service_role:USAGE`; on staging `pgsodium_keyiduser:CREATE,USAGE`. Effective `service_role` gains `CREATE` on staging.
  - `vault.secrets` and `vault.decrypted_secrets`: locally `postgres` and `service_role` hold `SELECT` and `DELETE`; on staging `pgsodium_keyiduser` holds every privilege. Effective `service_role` on staging adds `INSERT`, `UPDATE`, `TRUNCATE`, `REFERENCES` and `TRIGGER`. `decrypted_secrets` is a `supabase_vault` member locally but not on staging.
  - Folded Vault routine state: locally `SECURITY DEFINER` with a `search_path` setting, `EXECUTE` for `postgres` and `service_role` only. On staging it is invoker, with no setting, and `PUBLIC:EXECUTE`, so `anon` and `authenticated` have effective `EXECUTE`. Neither has `USAGE` on schema `vault` on either side.

  `20251113121601_schedule-payment.sql` reads `vault.decrypted_secrets` and calls `net.http_post`, so Vault matters to this application. These captures do not establish whether an application migration is permitted or appropriate to change platform-owned grants, or exhaust the available remediation choices. The responsible owner must decide the desired state and remediation. The root subsequently queried role membership only, confirming `service_role` is a member of `pgsodium_keyholder`, which is a member of `pgsodium_keyiduser`. This explains the observed inherited privileges. It does not approve those privileges or prove why they were originally granted.

#### Platform image and service version differences, documented

These are observed platform-owned object differences consistent with the different image and service versions. No effective API-role privilege difference appears in these groups. Version metadata alone does not establish the provenance or acceptability of each owner, grant, setting or body change. They remain named differences; neither classification nor this review approves security exceptions.

- **P3, `_realtime` (20 lines), local only.** Schema `_realtime` and its tables `extensions`, `feature_flags`, `schema_migrations` and `tenants`, with 7 constraints and 8 indexes. The local Realtime container (`realtime:v2.143.4`) keeps its tenant metadata in the project database. The schema is owned by the database owner, so the catalog counts it as an application schema (Step 2 revision 1). Hosted Realtime does not keep this schema in the project database.
- **P4, Realtime runtime (13 lines; `classify.py` counted the two publication lines in its `_realtime` group because its pattern also matches `supabase_realtime_messages_publication`).** Daily `realtime.messages_*` partitions differ by date: local `2026_10_16`–`2026_10_20`, staging `2026_08_06`–`2026_08_10`. Staging alone has the `supabase_realtime_messages_publication` publication with `realtime.messages`. The `realtime.schema_migrations` ACL differs: locally `dashboard_user` and `postgres` hold every table privilege; on staging there are no grants.
- **P5, Storage service (15 lines).**
  - Local only (storage-api v1.82.1): trigger `storage.buckets.enforce_versioning_status_transition` and its function, and relations `storage.iceberg_namespaces` and `storage.iceberg_tables`.
  - `supabase_storage_admin` grant option: locally grantable on schema `storage`, not grantable on `storage.buckets` and `storage.objects`; on staging the reverse.
  - Staging only: explicit `postgres` table grants on `storage.s3_multipart_uploads` and `storage.s3_multipart_uploads_parts`, and explicit grants on `storage.extension`, `storage.filename` and `storage.foldername` (to `anon`, `authenticated`, `dashboard_user`, `postgres` and `service_role`), plus on `storage.can_insert_object`, `storage.operation` and `storage.update_updated_at_column` (to `postgres`). `PUBLIC:EXECUTE` already gives these the same effective result.
- **P6, platform helpers in `extensions` (17 lines).** `grant_pg_cron_access`, `grant_pg_graphql_access`, `grant_pg_net_access`, `pgrst_ddl_watch`, `pgrst_drop_watch` and `set_graphql_placeholder` differ in `body_digest` and `config`. `grant_pg_cron_access` and `grant_pg_net_access` also differ in owner and ACL: locally `supabase_admin`, on staging `postgres`. The `issue_pg_graphql_access` event trigger's tags differ. No migration defines these, which `rg` confirmed. The platform image installs them in `extensions`, a schema owned by the database owner.
- **P7, Auth (4 lines).** Staging has an explicit `postgres:EXECUTE` on `auth.email()`, `auth.role()` and `auth.uid()`. Locally `postgres:SELECT*` is on `auth.schema_migrations`.
- **P8, `dashboard_user` (5 lines).** Staging grants `dashboard_user` `EXECUTE` on `pg_stat_statements` and `pgjwt` routines, including `pg_stat_statements_reset`, and every table privilege on `extensions.pg_stat_statements` and `pg_stat_statements_info`.
- **P9, extension member state (4 lines).** Locally `net.http_get` and `net.http_post` are `SECURITY DEFINER` with a `search_path` setting and explicit grants (pg_net 0.20.4). On staging (0.14.0) they share pg_net's invoker state. In both, `anon` and `authenticated` have effective `EXECUTE`. `graphql_public.graphql(…)` is a separate platform function on staging (pg_graphql 1.5.11), and locally it is in pg_graphql's folded state. `extensions.st_letters` carries a setting on staging (postgis 3.3.7), and locally it is folded.

### Deployment lag versus semantic drift

The only migration staging lacks is `20261015013845_webbing_catalog_snapshot.sql`. Comparing the 40-version local capture with the full 41-version capture gives exactly 4 lines:

- `relations public.webbing: columns: only in right: catalog_snapshot, registration_key`
- `constraints public.webbing.webbing_catalog_snapshot_valid: only in right`
- `indexes public.webbing_user_id_registration_key_idx: only in right`
- the `check_digest` of policy `public.webbing."Allow authenticated users to insert webbing"`

This is the planned deployment lag. It is not drift, and hosted state was not changed to remove it. Semantic drift outside that lag is B1 and B2. B3 and P3–P9 are platform state that the replay does not provision.

### Restore and full verification

| Command | Exit | Result |
| --- | --- | --- |
| `db reset --local --yes` (12:47:41–12:48:08 UTC) | 0 | 41 `Applying migration` lines. `Seeding data from supabase/seed.sql` and `supabase/seeds/association-billing-personas.sql` |
| History query | 0 | 41 rows, `20250206202200`–`20261015013845`, `(version, name)` equal to the 41 checked-in filenames |
| Catalog capture before tools | 0 | sha256 `b528b488af6d8415…` |
| `db lint --local --schema public --level error --fail-on error` | 0 | No findings |
| Catalog capture after lint | 0 | Byte-identical to the capture before tools |
| `test db --local <workdir>/supabase/tests` | 0 | `Files=12, Tests=371`, `Result: PASS` |
| Catalog capture after pgTAP | 0 | Byte-identical. All three pairwise compares exit 0, so lint and pgTAP leave no catalog residue |
| `node --test scripts/check-database-catalog.test.mjs scripts/verify-database.test.mjs` | 0 | 225/225 |

The owned stack `chooselife-verify-fb3593e92268` is **retained** with the descriptor above, in full 41-migration state with seeds, after lint and pgTAP. It has seven containers, volumes `supabase_db_…` and `supabase_storage_…`, and network `supabase_network_…`. It is kept for 003.4. Remove it only through the descriptor's cleanup command, after `assertOwnedWorkspace`.

### Developer stack preservation

`bin/snapshot.sh` read only `docker ps -a` ID, name, status and image, `docker inspect` name, ID, `StartedAt` and `RestartCount`, volume and network names, and the migration history through `psql`. Before: 12 `supabase_*_chooselife` containers, history 41 rows ending `20261015013845 webbing_catalog_snapshot`, sha256 `2b6d8c03…f027`. No `chooselife-verify` container, volume, network or temp directory existed. After, with owned resources filtered: inspect records and history are byte-identical. Volume and network names are identical. Non-owned `docker ps` ID, name and image are identical, and all 12 are still up. The developer stack was not stopped, reset or queried beyond that history read.

### Limits of this comparison

- Production was not inspected. This result covers staging only.
- The hosted catalog is a single capture taken by the root at 09:40 local time on October 17. It is not refreshed here, and no additional hosted query ran.
- The local image (`15.19.0.004`) is newer than staging's (`15.8.1.044`). The CLI pins its own image, so a same-image replay was not available. P3–P9 and the Vault half of B3 are consistent with version differences, but causality and security acceptance are not established by version metadata alone.
- The accepted catalog limits apply. Roles and memberships, the database, foreign servers, casts and operators are not captured. Extension members that share a folded state are not inventoried. That limit matters for B3. The root's separate membership query explains the observed inherited Vault privileges; role membership remains outside the reusable catalog.
- No live security probe ran, and no value was normalized away. The query, checker and tests are unchanged.


## Parent verification and review of003.3

Fresh Sol `/root/supabase_003_3_review` confirmed the diagnostic work and STOP were justified, with documentation-only FIX-FIRST findings about universal parity wording, inferred platform causality and unsupported remediation restrictions. Root corrected those statements above using the actual captures and two subsequent read-only metadata queries. The original comparison remains exit1 with217 differences; no security exception is accepted.

Parent independently asserted workspace ownership, queried the retained full replay and confirmed41 exact checked-in versions, captured a live catalog equal to the saved full catalog, and reran pgTAP:12files/371assertions/PASS. It reproduced217same-version differences and four deployment-lag differences. Developer container IDs/start times/restart counts and history match the pre-worker snapshot, with volume/network names unchanged after excluding the owned project. Evidence: `/tmp/chooselife-parent-stage-review-e10oQc/report.json`. Diagnostics are in the root stage capture directory as `bucket-dates-tool.json` and `pgsodium-memberships-tool.json`. A new fresh review of these documentation corrections is pending.

Reconciliation remains BLOCKED on B1/B2 desired-state decisions and unresolved security provenance/acceptance for B3/P3–P9. The existing scope excludes forward migration changes. Root has asked which legacy Storage configuration the eventual reconciliation should preserve. To continue independent authorized work, the root refined Plan003 so003.4 may regenerate types from the verified full local replay while003.3parity remains blocked. This does not authorize normalization, hosted changes or starting Plan004.


## Parent acceptance of003.3 diagnostic report

Fresh GPT-6.1-Sol High `/root/supabase_003_3_review_r2` returned SHIP at `c2b1ff11360e00034203177ebd46a19fa26410be` after the documentation corrections. Root accepts the diagnostic checkpoint only. The comparison remains exit1with217named differences and four separately explained deployment-lag lines. Staging reconciliation remains BLOCKED, no security exception is accepted, and Plan004 remains gated. Independent003.4 type generation from the verified full local replay is permitted by the refined plan;003.3parity is not marked complete. The retained owned descriptor above remains live and must pass ownership validation before use.


## Step 4: whole-artifact regeneration (003.4), STOPPED on a consumer diagnostic

Ran at base `27017a7` in this worktree, under the root's independence refinement. Private evidence: `/tmp/chooselife-003-4-private.Tkf83j`. It holds the before/after compiler output, the developer snapshots, the pre-generation catalog, copies of the old and new artifacts, a Prettier-normalized semantic diff produced in temp copies only, and the route diff.

### Preconditions

| Check | Exit | Result |
| --- | --- | --- |
| `bin/snapshot.sh` before | 0 | 12 developer containers. Inspect records and history sha `2b6d8c03…f027` match the 003.3 final snapshot |
| Prepared compiler baseline: web, mobile and UI `tsc --noEmit --incremental false` | 0, 0, 0 | No diagnostics. The ignored Next and Expo declarations were already present, so neither generator command ran |
| `assert-owned.mjs` on the retained descriptor | 0 | `chooselife-verify-fb3593e92268`. The copy has no `.env`, `project-ref` or pooler file; `.temp` holds only `cli-latest`. Migration files are byte-identical to the checkout |
| Owned history query | 0 | 41 versions ending `20261015013845`, equal to the checked-in versions |
| Inventory | 0 | `profile_isa_accounts` absent. The three required tables and two RPCs are present |
| Live catalog against saved `cap/local-full-posttest.json` | 0 | `Application catalogs match` |

### Generation

| Command | Exit | Result |
| --- | --- | --- |
| `bash supabase-gen-types.sh --check --workdir <owned root>` before | 1 | Drift, as expected |
| `bash supabase-gen-types.sh --workdir <owned root>` | 0 | Whole artifact replaced. sha256 `6385a97a…16a5`, 1609 lines (was 3407) |
| `bash supabase-gen-types.sh --check --workdir <owned root>` | 0 | Byte-identical |

All five required identities are present: `choosen_course_entitlements`, `festival_companion_config`, `festival_companion_tokens`, `register_festival_companion_token`, `unregister_festival_companion_installation`. `profile_isa_accounts` is absent. `packages/database/index.ts` is unchanged.

Formatting: as the brief instructs, the raw pinned output is kept. The CLI prints `Generated TypeScript is unformatted` and suggests oxfmt, as Plan 002 recorded. Raw `git diff` is +1519/−3317. After Prettier normalization of temp copies, the semantic diff is +232/−17:

- the five identities and `enqueue_festival_companion_notifications`
- `ComputedFields: never` on every table
- `Json` becoming `NonNullable<Json>` on NOT NULL json columns
- `Args: never` becoming `Args: Record<PropertyKey, never>`
- `push_tokens.platform` and newer Storage columns and functions from image `15.19.0.004`
- `highline.Insert.slug` becoming required

Two follow-ups for the root:

- `git diff --check` exits 2 on 15 trailing-whitespace lines inside the raw output.
- The root `format` script (`prettier --write "**/*.{ts,tsx,md}"`) would rewrite the artifact and break `--check`. No `.prettierignore` exists.

### Entitlement route

`next/app/api/courses/highline-beginner/access/route.ts` now imports `type { Database }` from `@/utils/supabase/database.types`, the existing shared re-export, and calls `createClient<Database>(`. Nothing else changed: same Bearer header, auth options, query, responses and R2 signing.

### New diagnostics, recorded before any consumer edit

Final typechecks: UI exit 0; web exit 1; mobile exit 1. The baseline had no diagnostics, so both errors are new.

- `expo/components/highline/highline-form.tsx(226,11): error TS2769: No overload matches this call.` `Property '"slug"' is missing in type '{ name; height; length; description; cover_image; anchor_a; anchor_b }' but required in type` the `highline` Insert.
- `next/components/CreateHighline.tsx(194,9): error TS2769`, the same missing `slug` on a `highline` insert.

Correction made in the 003.4 revision: this run first recorded these two paths swapped. The prefixes come from the `pnpm --filter` package directory in the compiler output. The paths above are correct.

Why they are new: `20261009120000_add_highline_slug.sql` adds `highline.slug text NOT NULL` with no default. The `BEFORE INSERT OR UPDATE` trigger `set_highline_slug` assigns `generate_highline_slug(NEW.name, NEW.id)` on every insert and keeps `OLD.slug` on update. The generator therefore types Insert `slug: string`. The previous `slug?: string` was hand-written in `ed30452` (#270), not generator output, and full regeneration removes it.

No consumer was edited. Sending a placeholder slug would change the request payload, which is runtime behavior; the trigger would discard the value anyway. A cast, `@ts-ignore` or untyped client is forbidden. The accurate type-only correction is an `Insert: { slug?: string }` entry under `highline` in the existing `MergeDeep` override in `packages/database/index.ts`. The 003.4 brief explicitly excludes that file. This is a scope expansion, so the step stopped here.

### Other gates, run for evidence

| Command | Exit | Result |
| --- | --- | --- |
| `pnpm --filter chooselife-web test` | 0 | 17/17 |
| `pnpm --filter chooselife-mobile exec jest features/course-guide --runInBand --watch=false --watchman=false` | 0 | 2 suites, 11 tests |
| `node --test scripts/verify-database.test.mjs scripts/check-database-catalog.test.mjs` | 0 | 225/225, sources unchanged |
| `--check` after the route edit | 0 | Whole-artifact byte parity holds |
| `bin/snapshot.sh` after | 0 | Developer inspect records, history sha, volumes, networks and count are byte-identical. Non-owned `docker ps` IDs and names are unchanged |

### State left

The regenerated artifact, the route edit and this section are **uncommitted** in the worktree. Committing them would put two failing typechecks on the branch. The owned stack `chooselife-verify-fb3593e92268` is retained, unchanged, under the same descriptor; validate ownership before reuse. 003.3 staging parity remains BLOCKED (217 differences, B1/B2/B3). 003.4 is not complete, and nothing here touches 003.5 or Plan 004.

## Step 4 revision: trigger-backed slug override and canonical formatting (003.4)

Ran at base `8af87b5` under the refined plan and the revised brief, which allows the shared override file, the helper and a new helper test. It continues the uncommitted inputs from the STOP above and verified their sha256 first: artifact `6385a97a…16a5`, route `92cdabe5…e296`, notes `ccd9bc60…02e6`. Private evidence: `/tmp/chooselife-003-4-private.Tkf83j/r2`. The first run's files, including the saved old artifact `generated-before.ts`, are untouched beside it. That run's raw artifact was saved as `r2/generated-raw-r1.ts` before regeneration.

This revision supersedes two parts of the STOP section: keeping the raw CLI output, and leaving the work uncommitted.

### Changes

| File | Change |
| --- | --- |
| `supabase-gen-types.sh` | Pipes the whole CLI stream through `node_modules/.bin/prettier --stdin-filepath <repo>/packages/database/database-generated.types.ts`, in a subshell that `cd`s to the repository root, into the existing `TEMP_FILE`. Checks the exit status of both pipeline stages through `PIPESTATUS`. Adds a dependency guard for the repository Prettier before any CLI call. Updates the header for the new formatting step and the exit-2 cases |
| `scripts/supabase-gen-types.test.mjs` | New. 7 tests that run the real helper copied into a temporary fixture, with a fake CLI and either the real repository Prettier or a failing fake |
| `packages/database/index.ts` | `highline.Insert.slug?: string` in the existing `MergeDeep` override, with a two-line comment naming the trigger. `Row.slug` is still required as generated. The POINT and notification overrides and the re-exports are unchanged |
| `packages/database/database-generated.types.ts` | Whole file regenerated by the updated helper from the owned replay. No hand edits |
| `next/app/api/courses/highline-beginner/access/route.ts` | Unchanged since the STOP: the `type { Database }` import and `createClient<Database>(`, 2 lines |

Override evidence: `20261009120000_add_highline_slug.sql:85-100` has a `BEFORE INSERT OR UPDATE` trigger that sets `NEW.slug := public.generate_highline_slug(NEW.name, NEW.id)` on every insert, before the NOT NULL check. The generated `Update.slug` is already optional, and the trigger keeps `OLD.slug` on update, so only Insert needed the override. Neither insert payload changed.

### Helper contract

- Exit codes are unchanged: 0 equal or written, 1 drift or missing artifact in `--check`, 2 usage, generation, formatting or filesystem error.
- A nonzero CLI exit fails even when its partial output formats and validates: `Type generation failed (supabase exit N, prettier exit M)`. A formatter failure reports `Formatting generated types with Prettier failed (exit M)`. In both cases, in write and check modes, the destination keeps its bytes and the `EXIT` trap removes the temporary file.
- Formatting always resolves configuration from the canonical artifact path, never from `--output`, the caller's cwd or the destination directory. Only the formatter subshell changes directory, so a relative `--output` still resolves against the caller.
- Unchanged: the explicit local repository CLI, `storage,public,functions`, `--linked` rejection, output path guards, the nonempty `export type Database =` check, `cmp`-based check without writes, the same-directory atomic `mv` and the signal traps.

The CLI still prints `Generated TypeScript is unformatted ... npx oxfmt` to stderr. That message comes from the pinned CLI and does not describe the helper's final output.

The 7 tests cover:

- canonical write, then `--check` exit 0, with output equal to repository Prettier, idempotent under a second pass, free of trailing whitespace, and the exact CLI arguments
- three destinations with identical canonical bytes: the default artifact, `expo/example.ts` beside a conflicting `.prettierrc.json`, and an external directory with a conflicting config reached through a relative `--output` from that directory. The test first proves the conflicting config would change the bytes
- `--check` exit 1 on a sentinel drift and on a missing artifact, without writing
- CLI exit 1 after complete valid output: exit 2 in write and check modes, prior bytes preserved
- formatter exit 2 after printing a valid-looking partial result: exit 2 in write and check modes, prior bytes preserved
- missing repository Prettier: exit 2 before the CLI is called
- empty output and output without the Database export: exit 2, prior bytes preserved

Every test asserts that the fixture `TMPDIR`, used by check-mode `mktemp`, and the destination directory, used for the write-mode dot file, hold no leftover temporary files. Prettier enables Node's compile cache under `TMPDIR`. The tests set `NODE_DISABLE_COMPILE_CACHE=1` so that this Node cache directory does not mask a leaked helper file. In normal use that cache lives in the system temp directory, as for any Prettier run.

Mutation check, in scratch copies outside the repository: the pre-revision helper fails 5 of 7 tests. Using `--stdin-filepath "$OUTPUT"` fails the destination test. Ignoring the CLI status fails the partial-output test. Ignoring the formatter status fails the formatter test.

### Owned stack and generation

| Command | Exit | Result |
| --- | --- | --- |
| `snapshot.sh` before | 0 | 12 developer containers. Inspect records, history sha `2b6d8c03…f027`, volumes and networks equal the first run's after-snapshot. Non-owned `docker ps` IDs and names unchanged |
| `assert-owned.mjs <descriptor>`, before every query and generation | 0 | `chooselife-verify-fb3593e92268` at `/private/var/folders/4d/px4017t53z7dx66qvy4fcvx00000gn/T/chooselife-verify-UCnOyZ`. `supabase/.temp` holds only `cli-latest`; no `.env`. Migration files byte-identical to the checkout |
| Owned history query | 0 | 41 versions ending `20261015013845`, equal to the checked-in versions |
| Owned inventory query | 0 | `profile_isa_accounts` absent. The three tables and two RPCs are present |
| `bash supabase-gen-types.sh --check --workdir <owned root>` | 1 | Drift: the committed-state artifact was raw |
| `bash supabase-gen-types.sh --workdir <owned root>` | 0 | Whole artifact replaced. sha256 `c30af021…9672`, 3624 lines |
| `bash supabase-gen-types.sh --check --workdir <owned root>` | 0 | Up to date |

No replay, reset or catalog capture ran in this revision. The 12 files and 371 SQL assertions are the evidence from the 003.3 restore; no SQL changed.

Artifact checks:

- Prettier applied to the first run's raw output, `r2/generated-raw-r1.ts`, is byte-identical to the new artifact. Formatting is therefore the only difference from the earlier generation.
- A second Prettier pass changes no bytes, and `prettier --check` on the artifact exits 0.
- The artifact has no trailing-whitespace lines, and `git diff --check` exits 0.
- Each of the five identities appears once. `profile_isa_accounts` appears 0 times.
- The raw `git diff` against HEAD is +2885/−2668 because the HEAD artifact was not Prettier-formatted. After Prettier normalization of the HEAD copy, the semantic diff is +232/−17, the same content listed in the STOP section.

### Gates

| Command | Exit | Result |
| --- | --- | --- |
| `pnpm --filter chooselife-web exec tsc --noEmit --incremental false` | 0 | No diagnostics. Both slug errors are gone |
| `pnpm --filter chooselife-mobile exec tsc --noEmit --incremental false` | 0 | No diagnostics |
| `pnpm --filter @chooselife/ui exec tsc --noEmit --incremental false` | 0 | No diagnostics |
| `pnpm --filter chooselife-web test` | 0 | 17/17 |
| `pnpm --filter chooselife-mobile exec jest features/course-guide --runInBand --watch=false --watchman=false` | 0 | 2 suites, 11 tests |
| `node --test scripts/verify-database.test.mjs scripts/check-database-catalog.test.mjs scripts/supabase-gen-types.test.mjs` | 0 | 232/232: 225 existing plus 7 new |
| `prettier --check` on the artifact, `index.ts`, the route and the new test | 1 | Only the route fails. The cause is a missing trailing comma at `route.ts:30`, outside the 2-line edit and already present at HEAD. Not fixed, because the route change is limited to the type import and generic |
| `git diff --check` | 0 | Clean |
| `snapshot.sh` after | 0 | Inspect records, history sha, volumes, networks and count equal the before-snapshot. Non-owned `docker ps` IDs and names unchanged |

The prepared Next and Expo declarations were already present, and `git status` shows only the six scoped files. The root `pnpm format` glob was not run. The older owned stack `049997ac2680` was not touched.

### State left

The six scoped files are committed on `t3/supabase-schema-workflow`, with no push or PR. The owned stack `chooselife-verify-fb3593e92268` is retained under the same descriptor for 003.5. 003.3 staging parity remains BLOCKED with 217 named differences. 003.4 waits for root verification and a fresh review. Nothing here touches 003.5, Plan 004, CI, `package.json`, the README, SQL or hosted state.


## Parent acceptance of003.4

Root accepts003.4 at `f1cc1cd` after fresh GPT-6.1-Sol High `/root/supabase_003_4_review` returned SHIP with no material findings. Parent independently passed232tooling tests, web/mobile/UI typechecks with no diagnostics,17web and11mobile tests, the real owned whole-artifact check, scratch generation matching the artifact and an idempotent formatter pass. A scratch sentinel correctly makes check exit1without changing scratch or artifact bytes. Developer state remains unchanged. Evidence: `/tmp/chooselife-parent-0034-final-mu9qhw/report.json`. The canonical artifact SHA256 is `c30af02141acdd1feecfda4faa3df817edc49ec229d344134b9ee79b65ab9672`. SQL, migrations, runtime behavior and hosted state are unchanged. The route formatting warning is pre-existing; the changed artifact/override/test files and whitespace checks pass.003.3parity remains blocked;003.5may proceed independently and cannot authorize Plan004.

## Step 5: local CI gate and catalog capture (003.5)

Status: done locally and waiting for root verification and a fresh review. It ran at base `1c25041` with a clean status, under the independence refinement. This step closes nothing on staging: 003.3 reconciliation remains BLOCKED, and Plan 004 stays gated.

Private evidence: `/tmp/chooselife-003-5-private.1dlhSl` (mode 700). It holds the developer snapshots under `snap/before|after`, command logs under `logs/`, the kept run's descriptor, a copy of the fresh catalog (`catalog-fresh.json`, sha256 `5590c218…a9dc`) and the scratch negative-check file. A scan for `sb_secret_`, `sb_publishable_`, JWTs, `Bearer` tokens and URL passwords found nothing outside copied test fixtures, which hold only the synthetic fake values.

Commands ran under Node 24.18.0 from nvm, pnpm 11.10.0 and repository CLI 2.121.0. No `SUPABASE*`, `PG*`, `DATABASE*` or `DOCKER*` variable was set.

### Changes

| File | Change |
| --- | --- |
| `scripts/verify-database.mjs` | New exported `captureCatalog(workspace)`, run as the step `Capturing schema catalog` right after the applied-version check and before lint and pgTAP. It asserts ownership, requires the copied `supabase/verification/catalog.sql`, runs `db query --local --file <copied absolute path> --output json` through the existing CLI wrapper, validates stdout with the accepted `extractCatalog`, and writes the validated payload to `<root>/catalog.json` through a `catalog.json.partial` rename. The descriptor gains `catalog` once a capture exists. `--check-types` drift now says to regenerate from a clean replay. The usage text no longer mentions known drift |
| `scripts/verify-database.test.mjs` | The fixture copies the real `check-database-catalog.mjs` and adds a synthetic `verification/catalog.sql`. The fake CLI answers `db query --file` with one synthetic 17-section catalog row. Existing tests now also assert the capture's position, its exact arguments and the kept descriptor's `catalog`. One new test, with 5 cases, covers failed capture |
| `.github/workflows/database.yml` | Runs all three helper test files and `pnpm db:verify --check-types`. Adds path triggers for the comparator and generator tests, `packages/database/**`, formatter configuration and direct type consumers |
| `supabase/README.md` | Only `## Local Verification` and `## Database Types` changed, plus a new `## Staging Comparison` section. Everything from `## Database Setup` onward is byte-identical to HEAD |

`package.json` did not change: `db:verify`, `db:types`, `db:types:check` and `db:catalog:compare` already exist. No SQL, catalog query, comparator, helper, generated type, override, route, migration, seed, config, dependency or lockfile changed.

### Capture contract

- Reusable entry point for Plan 004: `captureCatalog({ root, projectId })` from `scripts/verify-database.mjs`. It works on a kept descriptor's `path` and `projectId` and returns a short summary. The file is always `<root>/catalog.json`, holding the bare `chooselife.catalog.v2` payload that `pnpm db:catalog:compare` reads.
- It fails closed, with exit 1 and normal cleanup, in four cases. The copied query may be missing. The query may exit nonzero; then only stderr is shown, redacted, and stdout is dropped because it can hold partial payload values. Stdout may be malformed or truncated JSON. Or the result may fail `validateCatalog`, for example with a missing section, a count mismatch or incomplete visibility. In those cases `Catalog capture is invalid: <checker message>` is reported. Checker messages name sections and identities, never values. No bypass flag exists.
- The payload is never printed. Success prints section and object counts and the file path.
- Without `--keep`, cleanup removes `catalog.json` with the project directory.

### Tests

| Command | Exit | Result |
| --- | --- | --- |
| `node --test scripts/verify-database.test.mjs scripts/check-database-catalog.test.mjs scripts/supabase-gen-types.test.mjs` | 0 | 238/238. At HEAD there were 232: 39 + 186 + 7. Now 45 + 186 + 7, from one new test with 5 cases. No existing test was removed |

The new cases cover a query exit 1 whose stdout holds part of the payload, including a sentinel, and whose stderr holds a fake secret. They also cover truncated JSON, a non-catalog format, a payload missing `storage_buckets`, and a missing query file. Each case asserts exit 1, the specific message, neither the sentinel nor any fake secret in the output, `stop` as the last call, no `db lint`, `test db` or type generation, and an empty temp directory. The passing and `--keep` tests assert that the sentinel never reaches the output, and that `readCatalog(descriptor.catalog)` deep-equals the synthetic payload.

Mutation check, in scratch copies outside the repository. Moving the capture after lint fails 9 tests. Adding stdout to the failure output fails 2. Accepting an invalid payload fails 4. Removing the step fails 10.

### Real runs

| Command | Exit | Result |
| --- | --- | --- |
| Old retained `chooselife-verify-fb3593e92268`: `assertOwnedWorkspace` then `cleanupWorkspace`, from the repository module | 0 | Removed: no container, volume, network or directory left. `049997ac2680` was not targeted |
| `pnpm db:verify --check-types` (13:24:57–13:56:32 UTC) | 0 | `chooselife-verify-63145e9af104`: 41 migrations, `41 versions match 41 files`; catalog `17 sections, 787 objects` captured before lint; lint ok; pgTAP `12 files, 371 assertions`; `generated types match`; `Removed the disposable project` |
| `pnpm db:verify --keep --check-types` (13:59:16–14:00:18 UTC) | 0 | `chooselife-verify-40509a6ce0ba`, the same results, with timestamps per step: start 29 s, reset 26 s, capture 1 s, lint 1 s, pgTAP 3 s, types 1 s. The descriptor printed `catalog` at `<path>/catalog.json` |
| `assertOwnedWorkspace` and `readCatalog` on the kept descriptor | 0 | 17 sections, 787 objects, 408,168 bytes, `complete_visibility` true |
| `pnpm db:catalog:compare <fresh catalog> <003.3 cap/local-full-posttest.json>` | 0 | `Application catalogs match`, with no environment lines |
| `bash supabase-gen-types.sh --workdir <kept> --output <scratch>` | 0 | Scratch is byte-identical to the artifact |
| `--check --workdir <kept> --output <scratch>`, before and after appending `// SENTINEL_DRIFT` | 0, then 1 | Scratch bytes unchanged by the check, `Database types are out of date` |
| `bash supabase-gen-types.sh --check --workdir <kept>` | 0 | The production artifact sha256 stays `c30af021…9672`, before and after |
| `cleanupWorkspace` on the kept descriptor, after `assertOwnedWorkspace` | 0 | Removed. No `chooselife-verify` container, volume, network or temp directory remains |

The first run took 31.5 minutes. A mid-run process check found the stack containers only about 30 seconds old while the pgTAP `docker run` was already in progress, around 13:39–13:40 UTC. So about 14 minutes passed before the stack came up, and about 16 minutes passed from pgTAP to the end. pgTAP and type generation each start their own image. The second run took 62 seconds. Docker kept no events for that window, so the cause is not established; one-time image pulls are likely. In CI every image is pulled fresh, so the 30-minute job timeout was not observed under CI conditions.

### Application gates

The prepared Next and Expo declarations were already present, so no generator ran.

| Command | Exit | Result |
| --- | --- | --- |
| `pnpm --filter chooselife-web exec tsc --noEmit --incremental false` | 0 | No diagnostics |
| `pnpm --filter chooselife-mobile exec tsc --noEmit --incremental false` | 0 | No diagnostics |
| `pnpm --filter @chooselife/ui exec tsc --noEmit --incremental false` | 0 | No diagnostics |
| `pnpm --filter chooselife-web test` | 0 | 17/17 |
| `pnpm --filter chooselife-mobile exec jest features/course-guide --runInBand --watch=false --watchman=false` | 0 | 2 suites, 11 tests |

### Workflow validation

`actionlint` and `yamllint` are not installed and were not installed for this step. The workflow was parsed with the already-installed `yaml` package in strict mode with unique keys. It has no errors or warnings, and the `pull_request` and `push` path lists are identical, with 39 unique entries. Every literal path is tracked except `.prettierignore`, which Prettier would honor if added, like `.prettierrc*` and `prettier.config.*`. The parse also confirmed these settings: `contents: read`; `persist-credentials: false`; pnpm `11.10.0`; Node from `.nvmrc` with the pnpm cache; `pnpm install --frozen-lockfile`; `timeout-minutes: 30`; the cancel-in-progress concurrency group; and no `${{ secrets.* }}`, link, push or deploy. `packages/database/package.json` was replaced by its superset `packages/database/**`.

Direct type consumers are taken to be the modules that import `@chooselife/database` or the generated file directly, or that re-export them: the three shims, six `next` modules, six `packages/ui` modules and the entitlement route. Modules that import through a shim are not listed. The `[locale]`-style segments use the documented `\[` escape. GitHub only treats brackets as alphanumeric classes. Whether GitHub matches these patterns was not observed: no workflow was dispatched, pushed or opened as a PR. No hosted CI result exists for this step.

### Format and scope

- `git diff --check` exits 0. `prettier --check` passes for both scripts.
- Prettier would rewrite the workflow's single quotes to double quotes. The HEAD file fails the same way, so the existing style was kept.
- In the README, Prettier reports only two blank lines inside the hosted section. They are present at HEAD and were kept, because that section must stay byte-identical. The changed sections are Prettier-clean.
- `git status` shows only the five owned files.

### Developer stack preservation

`snapshot.sh`, reused from 003.3, ran before and after. It shows 12 containers, all up. Inspect records (IDs, `StartedAt`, restart counts), the history sha `2b6d8c03…f027` and the count are identical, and non-owned `docker ps` IDs, names and images are identical. The before-snapshot also matched 003.3's after-snapshot. The only volume and network differences are the three resources of the removed `fb3593e92268` project.

### Deviations and limits

- The run reused only the old retained stack's descriptor, for removal. Every replay in this step is new.
- The helper's drift message still says `Run pnpm db:types to regenerate`, which reads the developer stack by default. The README recommends a clean replay instead. The helper is outside this step's scope, so its message was left alone.
- `pnpm db:verify --check-types` proves local parity only. It does not compare staging.

### State left

The five files are committed locally on `t3/supabase-schema-workflow`, with no push or PR. No owned stack or workspace remains: `fb3593e92268`, `63145e9af104` and `40509a6ce0ba` are all removed, and only the private evidence directory is kept. Staging reconciliation 003.3 remains BLOCKED on B1 (bucket configuration), B2 (schema `public` `PUBLIC:USAGE`) and B3 with the other platform security differences, none accepted. The one-migration deployment lag remains, and production remains uninspected. Plan 003 is not complete, and Plan 004 is not authorized.


## R2 storage decision and current status (003.5 documentation revision)

User decision, October 17, 2026, answering the root's question about which legacy Storage configuration to preserve: "No need for staging rules. I currently migrated to R2 storage." R2 is the active storage backend for application media. Legacy Supabase Storage bucket IDs, bucket existence and MIME configuration are outside the reconciliation target and the desired state.

Effect on the 003.3 blockers:

- **B1 is resolved as a scope choice.** The B1 lines recorded above stay as historical diagnostics, and the October 17 comparison still exited 1 with 217 differences. The decision does not ask for the buckets or their MIME rules to be reproduced in a migration or desired schema, and it does not ask for hosted buckets to be hardened, cleaned up or deleted. No hosted bucket was changed. The decision covers bucket configuration only: no Storage grant, policy or other security exception is approved, and no broad ignore is introduced.
- **B2**, schema `public` `PUBLIC:USAGE`, remains unresolved and blocking.
- **B3** and the other platform security provenance remain unresolved and blocking. No security exception is accepted.
- The one-migration deployment lag, `20261015013845_webbing_catalog_snapshot`, remains a pending deployment. Production remains uninspected.

The catalog query and checker are unchanged. They still capture and compare all 17 sections, including `storage_buckets`, so a hosted comparison still reports the B1 lines. Narrowing the parity scope requires its own explicit, reviewed implementation.

### README change

In `supabase/README.md`, only the `## Staging Comparison` status block changed. It now says application media is in R2, marks B1 as outside the target by the owner's decision with no hosted cleanup authorized, keeps B2 and B3 blocking with no accepted exception, keeps the historical 217-difference result, and states that the checker and its 17 sections are unchanged. Everything from `## Database Setup` onward is byte-identical to `4d60d1a`.

### Root verification of 003.5 source

Recorded from the root's report, not rerun here: `/tmp/chooselife-parent-0035-real-FKUMVk/report.json`. The root inspected the full five-file diff of `49b4678` and independently passed 238 helper tests, the web, mobile and UI typechecks with no diagnostics, 17 web tests and 11 mobile tests. Its real fresh `pnpm db:verify --keep --check-types` on owned project `chooselife-verify-0e058ba89ab7` took 66.879 s: 41 migrations, a catalog of 17 sections and 787 objects equal to the accepted full capture, 12 SQL files with 371 assertions, and type parity exit 0. A scratch sentinel made the check exit 1 without writing. Developer state was unchanged and the owned root was removed. The artifact sha256 is `c30af02141acdd1feecfda4faa3df817edc49ec229d344134b9ee79b65ab9672`. No owned stack is live, and older descriptors point at removed workspaces.

### Review state

The first fresh Sol review, `/root/supabase_003_5_review`, failed on provider usage before returning any verdict. That is neither an approval nor a code finding. A new fresh review of all 003.5 source, including `49b4678` and this documentation commit, is pending.

### State left

003.5 is not accepted. This commit is local on `t3/supabase-schema-workflow`, with no push or PR. Plan 003 is not done: staging reconciliation stays BLOCKED on B2 and B3, and Plan 004 remains gated.
