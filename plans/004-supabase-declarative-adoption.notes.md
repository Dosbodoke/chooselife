# Plan 004 notes: declarative Supabase schema adoption

## Step 1: confirm the engine in an owned disposable project (004.1)

Status: done locally. It awaits root verification and a fresh review before 004.2. This is temporary preparation only. No tracked config, schema tree, script, test, SQL, migration, seed, type or workflow changed. No hosted project was read or written. Hosted 003.3 reconciliation remains unresolved on B2 (schema `public` `PUBLIC:USAGE`) and B3 (Vault/pgsodium and other platform-security provenance). Nothing here accepts a security exception or claims staging parity.

Base: `fe59950` on `t3/supabase-schema-workflow`, with a clean status. Node 24.18.0 (nvm), pnpm 11.10.0, repository CLI 2.121.0 (`node_modules/.bin/supabase --version`). No `SUPABASE*`, `PG*`, `DATABASE*` or `DOCKER*` variable was set. Every CLI child ran through the verifier's `childEnv()` filter with explicit `--workdir <owned root>` and `--local`. No `--linked`, `--db-url` or link state was used.

Private evidence: `/tmp/chooselife-004-1-private.ZwMLAw` (mode 700). It holds the developer snapshots under `snap/before|after`, command logs under `logs/`, the kept descriptor (`descriptor.json`), the owned config copy (`owned-config.toml`), both catalog captures, the source checksum manifests, the read-only inventory query and the runner `run-0041.mjs`. The runner imports the accepted `assertOwnedWorkspace`, `captureCatalog`, `childEnv` and `parsePgProveSummary` from `scripts/verify-database.mjs`, and it asserts ownership before every CLI call.

### Documentation checked

- [Changelog](https://supabase.com/changelog.md), fetched October 17, 2026. The 2026-04-16 entry announces pg-delta as a Public Alpha. No breaking-change entry touches declarative sync/generate or the `[experimental.pgdelta]`/`[experimental.webhooks]` keys. Two entries are worth noting for later steps. On 2026-07-14 the hosted `realtime` schema was locked against modification. On 2026-09-25 PostgreSQL 15.19 brought pgcrypto/btree_gist/ltree actions; those apply to hosted data, not to the local engine flags.
- [Declarative database schemas](https://supabase.com/docs/guides/local-development/declarative-database-schemas). Its findings are listed below.
  - `db schema declarative` requires `[experimental.pgdelta] enabled = true`, or `--experimental` for a single run.
  - The sync baseline is the migration history, not the live database.
  - The CLI warns when `schema_paths` lists paths under pg-delta, because ordering is automatic.
  - DML, including bucket rows, is never captured. Named `pg_cron` jobs are tracked as extension configuration.
  - Untracked kinds are casts, operators, opclasses/families, text-search objects, statistics, languages, transforms and parameter ACLs. `--strict-coverage` turns those warnings into failures.
  - In managed schemas, only customizations such as triggers whose function lives outside the schema and policies on the listed tables are diffed. Other app objects inside `auth`/`storage` are skipped.
  - **Adopting an existing schema tree**: "If your migrations call `pg_net` (for example, database webhooks), add `[experimental.webhooks]` with `enabled = true` to `config.toml` first." Extensions created by migrations must also be declared.
- [Diff engines](https://supabase.com/docs/guides/local-development/diff-engines). The engine is selected by `[experimental.pgdelta] enabled = true`. A run may write several `_1`, `_2` files, and `-- pg-delta: transaction=false` files are possible. That matters for the 004.3 checker's file-count handling.
- Pinned sources: [generate.command.ts](https://github.com/supabase/cli/blob/v2.121.0/apps/cli/src/commands/db/schema/declarative/generate/generate.command.ts) and [sync.command.ts](https://github.com/supabase/cli/blob/v2.121.0/apps/cli/src/commands/db/schema/declarative/sync/sync.command.ts). In sync, `--apply` and `--no-apply` are mutually exclusive, and `--apply` or global `--yes` applies locally.

### CLI help (exact binary)

| Command                                                                       | Exit | Relevant flags                                                                                                             |
| ----------------------------------------------------------------------------- | ---- | -------------------------------------------------------------------------------------------------------------------------- |
| `node_modules/.bin/supabase --agent no db schema declarative generate --help` | 0    | `--local`, `--linked`, `--db-url`, `--output-dir`, `--overwrite`, `--strict-coverage`, `--schema`, `--no-cache`, `--reset` |
| `node_modules/.bin/supabase --agent no db schema declarative sync --help`     | 0    | `--file/-f`, `--name`, `--apply`, `--no-apply`, `--strict-coverage`, `--schema`, `--no-cache`                              |

No `sync --check` exists. `generate --reset` was not used, and must never target the developer stack or an implicit workdir.

### Engine settings decision

Only the owned copy's config changed: two sections were appended. The `diff` against its pre-change copy (`config.before-0041.toml` in the owned root) shows exactly these lines:

```toml
[experimental.pgdelta]
enabled = true

[experimental.webhooks]
enabled = true
```

- `pgdelta` is the documented engine switch that the declarative commands require.
- `webhooks` is required because migration `20251113121601_schedule-payment.sql:6` creates `pg_net` and calls `net.http_post`, which is the documented adoption gate. The pinned binary enforces the gate in sync. It raises "The migrations state includes pg_net, but Database Webhooks are not enabled in the local project config" when the declared tree has no manifest and `pg_net` is in the migration removals, and a matching error when the declared tree uses `pg_net`.
- Runtime effect, read from the pinned 2.121.0 binary. With the flag on, local and shadow DB setup runs `create extension if not exists pg_net schema extensions;` (`enable-database-webhooks.sql`), and the flag enters the shadow-cache key. The migration's own `create extension if not exists pg_net with schema "extensions"` then becomes a no-op. The `daily-renewal-check` cron job that called `net.http_post` is already unscheduled by `20260826180000_reconcile_association_billing_stage.sql:255`. No webhook trigger, function hook or credential is created. The post-settings catalog is byte-identical to the baseline, as shown below.
- Once the section exists, the validator rejects `enabled = false` ("Webhooks cannot be deactivated").
- **Caution for 004.3 promotion.** In the pinned binary, `supabase config push` with `experimental.webhooks.enabled = true` calls the Management API `enableDatabaseWebhook` on the linked project. Putting this key in the tracked config therefore has a hosted side effect if anyone runs `config push`. That is not authorized, and the promotion review must address it explicitly.
- `schema_paths` stays absent. The DB stays on major version 15. `project_id`, ports, seeds (`./seed.sql`, `./seeds/association-billing-personas.sql`), pooler (disabled) and auth/storage/realtime settings are unchanged from the verifier's standard transform. The tracked `supabase/config.toml` sha256 is `6e31a479…b15b`, the same before and after.

### Owned baseline and post-settings gates

| Command                                                             | Exit | Result                                                                                                                                                                                                                                     |
| ------------------------------------------------------------------- | ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `pnpm db:verify --keep --check-types` (18:27:42–18:28:42 UTC, 60 s) | 0    | `chooselife-verify-9a6d114e5172`: 41 migrations, `41 versions match 41 files`; catalog `17 sections, 787 objects` captured before lint; lint ok; pgTAP `12 files, 371 assertions`; `generated types match`                                 |
| `run-0041.mjs precheck` (`assertOwnedWorkspace` first)              | 0    | 0 env/link/project-ref/pooler-url entries. `migrations/` (41 files), `seed.sql`, `seeds/`, `tests/` and `verification/` are byte-equal to the checkout. `.temp` holds only `cli-latest`. The config has no pgdelta/webhooks/`schema_paths` |
| Baseline catalog vs accepted 003.5 `catalog-fresh.json`             | 0    | Byte-identical (sha256 `5590c218…a9dc`). `pnpm db:catalog:compare`: `Application catalogs match`                                                                                                                                           |
| `run-0041.mjs configure`                                            | 0    | Owned config `aab4bbca…4983` → `7ea0ac4e…2370`                                                                                                                                                                                             |
| `db reset --local --yes` on the owned workdir                       | 0    | 26.4 s                                                                                                                                                                                                                                     |
| `db query --local` on `supabase_migrations.schema_migrations`       | 0    | 41 rows; `<version>_<name>.sql` equals the 41 migration filenames exactly, in order                                                                                                                                                        |
| `db query --local` on `supabase_migrations.seed_files`              | 0    | `supabase/seeds/association-billing-personas.sql`, `supabase/seed.sql`                                                                                                                                                                     |
| `captureCatalog({root, projectId})`, before lint/pgTAP              | 0    | `17 sections, 787 objects`, **byte-identical** to the baseline (`5590c218…a9dc`). `pnpm db:catalog:compare baseline settings`: `Application catalogs match`                                                                                |
| `db lint --local --schema public --level error --fail-on error`     | 0    | Clean                                                                                                                                                                                                                                      |
| `test db --local <owned>/supabase/tests`                            | 0    | `Files=12, Tests=371`, `PASS`                                                                                                                                                                                                              |
| `bash supabase-gen-types.sh --check --workdir <owned root>`         | 0    | The artifact sha256 stays `c30af021…9672`                                                                                                                                                                                                  |

The post-settings sequence (reset through type check) ran 18:29:09–18:29:42 UTC.

### Read-only inventory for 004.2 (no export, no sync)

A metadata-only query (`coverage-inventory.sql`) ran on the owned DB after the gates. It read no rows, bodies, arguments or Vault values.

- Untracked kinds outside extensions: 0 casts, operators, opclasses, opfamilies, text-search configs, dictionaries, parsers, templates, statistics objects, languages and transforms.
- Parameter ACLs: 1, `log_min_messages`, granted to `supabase_realtime_admin`. It comes from the platform; no migration grants on parameters. Whether `--strict-coverage` reports it, and how, is for 004.2 to observe. Per the docs it must not go into `_custom/`.
- Application schemas: `public` and `gis`. Extensions (all owned by `supabase_admin`): plpgsql, uuid-ossp, pgcrypto, pg_stat_statements, supabase_vault, pg_net, pg_graphql, pgjwt, postgis, pg_cron, unaccent. Extensions created by migrations need declarations, as the adoption section says.
- Managed-schema customizations: one trigger, `auth.users/on_auth_user_created → public.handle_new_user`, which the engine supports. There are no postgres-owned functions or relations in managed schemas apart from `supabase_migrations` bookkeeping. The only policies on managed tables are the platform's `cron.job`/`cron.job_run_details` policies.
- Cron: the three expected named jobs. Publication `supabase_realtime` has 4 tables: the three festival schedule tables plus `festival_schedule_revision`. 4 Storage bucket rows remain DML; they are retired by the R2 decision and must not be declared.
- What 004.2 must still prove: strict-coverage export completes, no pg_net/extension gate trips, `_cluster` role output and default-privilege overlay files carry no credential literals, and no-op sync writes zero migration files.

### Source and developer preservation

- The sha256 manifest of 94 tracked files under `supabase/`, `packages/database/`, `scripts/`, `.github/`, `package.json`, `pnpm-lock.yaml` and `supabase-gen-types.sh` is identical before and after. `supabase/schemas/` does not exist. Before this commit, `git status` was clean apart from this notes file.
- Developer stack: `snapshot.sh` (reused from 003.5) ran before and after. 12 containers, all up. Their IDs, `StartedAt` and restart counts are identical, the history sha is `2b6d8c03…f027` (41 rows), and non-owned `docker ps` IDs, names and images are identical. The only volume and network additions are the owned project's `supabase_db_`, `supabase_storage_` and `supabase_network_chooselife-verify-9a6d114e5172`. Only metadata and migration history were read.

## Deviations

- Post-settings checks used explicit CLI, query, capture, lint, test and helper commands through a private runner, not `pnpm db:verify`, because the verifier would build a new copy from the tracked config. The runner moved the verifier's `catalog.json` to `catalog-baseline.json` inside the owned root so `captureCatalog` could write a fresh file. No runner or tracked script changed.
- The first inventory query failed with a type error (`text || "char"`) before returning anything. It was fixed with a cast and rerun.

## How the run ended

004.1 succeeded. One owned stack is retained for 004.2: 7 containers running, the engine settings applied, the DB at full 41-migration replay plus seeds, with lint and pgTAP completed. The parent subsequently confirmed the extension inventory is unchanged before/after those tools and that no `pgtap` extension remains. 004.2 must reset before export, as its step requires.

Non-secret descriptor:

```json
{
  "path": "/private/var/folders/4d/px4017t53z7dx66qvy4fcvx00000gn/T/chooselife-verify-Nq18nP",
  "projectId": "chooselife-verify-9a6d114e5172",
  "ports": {
    "api.port": 63709,
    "db.port": 63710,
    "db.shadow_port": 63711,
    "db.pooler.port": 63712,
    "studio.port": 63713,
    "inbucket.port": 63714,
    "edge_runtime.inspector_port": 63715,
    "analytics.port": 63716
  }
}
```

Cleanup, after `assertOwnedWorkspace({ root, projectId })`:

```bash
'/Users/juangsandrade/.t3/worktrees/chooselife/t3-f4bb91a0/node_modules/.bin/supabase' --workdir '/private/var/folders/4d/px4017t53z7dx66qvy4fcvx00000gn/T/chooselife-verify-Nq18nP' stop --project-id chooselife-verify-9a6d114e5172 --no-backup && rm -rf '/private/var/folders/4d/px4017t53z7dx66qvy4fcvx00000gn/T/chooselife-verify-Nq18nP'
```

No other owned resource exists. No push or PR. This checkpoint is not accepted until root verification and a fresh review. Hosted B2/B3 remain unresolved release gates.


## Parent verification of004.1

Root independently asserted ownership and verified that only the two experimental sections were added to the owned copy. It reran the owned reset, exact41version history, both seed records, pre-tool catalog capture, lint,12files/371SQLassertions and the complete generator check. All passed. The catalog matches the pre-settings baseline, the artifact SHA remains `c30af02141acdd1feecfda4faa3df817edc49ec229d344134b9ee79b65ab9672`, and developer IDs/start times/restart counts/history/volume/network names remain unchanged. The extension inventory is equal before and after lint/pgTAP, with no remaining `pgtap` extension; the earlier claim that helpers remain was corrected. A reset before004.2export remains required by the plan, rather than by an observed lingering helper. Parent evidence: `/tmp/chooselife-parent-0041-ChLDVG/report.json`. Fresh Sol review is still pending; this paragraph does not accept004.1or authorize promotion of tracked settings.


## Parent acceptance of004.1

Root accepts local004.1 at `17f895a` after fresh GPT-6.1-Sol High `/root/supabase_004_1_review` returned SHIP with no material findings. It reviewed the corrected extension statement and the independent parent gates above. The owned descriptor is retained for004.2, which must reset and prove strict private export plus a zero-file-change no-op before fresh review and any tracked promotion. The webhook config-push side effect and hostedB2/B3compatibility gates remain unresolved. This acceptance changes no tracked configuration or schema source.
