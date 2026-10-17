# Plan 004: Adopt declarative Supabase schemas with independent parity checks

> Execute this plan in order in a separate checkout. Keep `plans/004-supabase-declarative-adoption.notes.md` with `## Deviations` and `## How the run ended`, and update the index row. This is a behavior-preserving authoring migration. All generated baseline/probe migrations used for verification live in owned disposable projects, never in the deployable migration history.

## Status

- Priority: P1
- Effort: L
- Risk: MED, gated by independent catalog and authorization checks
- Depends on: completed Plans 002 and 003
- Category: migration, direction, dx
- Planned at: commit `427007b`, October 16, 2026

## Outcome and decisions

Maintain the complete desired application schema under `supabase/schemas/`, using the pinned CLI's current `pg-delta` engine. Contributors edit desired SQL, generate and review incremental migrations, then test and release those migrations. Preserve every historical migration and existing runtime behavior. R2 is the active storage backend under the user's October17 decision. Do not recreate legacy Supabase Storage buckets, IDs or MIME rules in desired schema or new migrations. Historical bucket rows may remain diagnostic evidence; their exclusion from any future parity decision must be narrow and explicit, not a broad ignore of Storage grants, policies or schema objects.

The initial conversion must generate no unexplained migration. Prove more than a visually plausible export: independently reconstruct the declared schema in a fresh platform database and compare its application catalogs with full historical replay. Keep explicit data migrations and operational provisioning separate.

Decisions selected by the user on October 16, 2026: implement the verification foundation, baseline/types reconciliation, and declarative adoption as ordered plans. This plan authorizes local implementation and verification, not cloud deployment, history repair or production reset.

## Prerequisite contract and drift check

These capabilities must already exist; their contracts are inlined so the executor does not need another conversation or plan:

- CLI exactly 2.121.0 from the repository dependency, Node 24.18.0 and pnpm 11.10.0.
- `pnpm db:verify [--keep] [--check-types]` creates a unique, isolated project/workdir, fresh-replays migrations and seeds, lints SQL and runs every SQL test. `--keep` retains an owned descriptor and cleanup command. Its workspace-preparation/cleanup functions are reusable without starting a stack on module import.
- `bash supabase-gen-types.sh [--check] [--workdir <project root>] [--output <path>]` safely generates the complete `storage,public,functions` artifact using explicit local targeting. The checked-in shared artifact now matches clean full replay.
- `supabase/verification/catalog.sql` returns stable, nonsecret application metadata: objects, definition digests, constraints, RLS, direct/default/effective ACLs, managed-schema customizations, function attributes, Realtime and named cron configuration. It excludes user rows, credentials, runtime sequence state, platform internals, extension-owned internals and migration/pgTAP bookkeeping.
- `pnpm db:catalog:compare <left.json> <right.json>` compares that metadata and fails on semantic differences. Fixture tests cover lost policies/permissions, changed bodies, auth triggers, cron commands and enum order.
- `.github/workflows/database.yml` is a root, verification-only, cloud-credential-free workflow that runs `pnpm db:verify --check-types`.
- Baseline reconciliation established same-version staging parity, or documented and resolved any prior divergence. Pending deployments were recorded; production was not assumed equivalent to staging.

First verify:

```bash
git status --short
git diff --stat 427007b..HEAD -- supabase scripts package.json packages/database .github/workflows/database.yml supabase-gen-types.sh
pnpm exec supabase --workdir . --version
node --test scripts/verify-database.test.mjs scripts/check-database-catalog.test.mjs
pnpm db:verify --check-types
```

Expected predecessor changes are valid. Reconcile any additional schema/migration/contract changes before exporting; the current checked-in migration chain, not a stale table count or the developer's database, defines the target. Stop if prerequisites are absent or the parity gates are not green.

## Current state and project constraints

At the planned revision there are 41 migrations, no desired-state tree and no `[experimental.pgdelta]` section. Two large billing migrations total 9,515 lines. `get_highline` and booking functions have several historical definitions. Editing one current object definition is the benefit of this conversion.

Representative definitions that must survive:

- `supabase/migrations/20250605202359_handle_new_user_trigger.sql:14` creates the custom managed-schema trigger:

  ```sql
  create trigger on_auth_user_created
    after insert on auth.users
    for each row execute procedure public.handle_new_user();
  ```

  The function has an empty search path and inserts the profile with `on conflict (id) do nothing`.
- Billing permissions are intentionally restrictive. `supabase/migrations/20260823144005_association_billing_cutover.sql:4572` revokes function access before granting the intended RPCs. The account-deletion closure is service-role-only, tested at `supabase/tests/fixed_day_recurring_obligations_test.sql:698`.
- `supabase/migrations/20260429120000_festival_queue.sql:1020` sets FULL replica identity and adds `festival_schedule_window`, `festival_schedule_slot` and `festival_schedule_booking` to `supabase_realtime`.
- Final cron contract: `festival-schedule-reconcile-every-minute` calls `reconcile_festival_schedule()` every minute; `festival-schedule-open-notifications-every-30-minutes` calls its matching enqueuer every 30 minutes; `festival-companion-notifications-every-minute` calls its matching enqueuer every minute. Current docs support named jobs through extension configuration, despite their storage as rows.
- `supabase/migrations/20260826180000_reconcile_association_billing_stage.sql:247` removes obsolete billing/renewal jobs. Preserve that absence. Manual PIX billing has no automatic settlement or renewal job.
- The singleton insert into `festival_companion_config` at `supabase/migrations/20260730140837_festival_live_companion.sql:11`, Storage bucket inserts, and historical association-person backfills are DML. Their continued delivery belongs to migrations/seeds, not schema export.
- `supabase/README.md:88` and `:99` contain obsolete renewal/Vault setup instructions. A push webhook is documented as manual at `expo/README.md:79`; catalog inspection did not find a notifications-table webhook in local or stage. Do not create a delivery integration or invent credentials during conversion.
- Existing local-only `profile_isa_accounts` was absent from checked-in migrations during planning. Include it only if it is now part of the committed, verified migration chain; otherwise preserve that separate work without exporting it.

## Scope and git workflow

Modify only:

- `supabase/config.toml`, limited to declarative-engine/webhook shadow support settings
- `supabase/schemas/**` to create as the complete desired-state tree
- `scripts/check-declarative-schema.mjs`, `scripts/check-declarative-schema.test.mjs` to create
- `scripts/verify-database.mjs` and its tests for reusable isolated verification
- `supabase/tests/schema_contract_test.sql` to create
- `supabase/verification/catalog.sql` and its comparator/tests only if necessary to cover a demonstrated missing parity field; record it
- `package.json`, `.github/workflows/database.yml`, `supabase/README.md`
- The plan index and this plan's notes

All existing migrations, seeds, application source, generated TypeScript types, deployment scripts, runtime client configuration and hosted state stay unchanged. The committed conversion should add **no** migration under `supabase/migrations/`. If an actual missing schema change is discovered, return it for a separate forward migration before restarting this plan.

Use a branch based on completed Plan 003, for example `advisor/004-supabase-declarative`. Match conventional commits such as `chore(db): adopt declarative schema authoring`. Remote deploy/push/PR actions follow the operator's separate instructions.

## Steps

### 1. Confirm engine behavior and enable the documented path

Inspect the exact binary's help:

```bash
pnpm exec supabase --workdir . db schema declarative generate --help
pnpm exec supabase --workdir . db schema declarative sync --help
```

On 2.121.0, generation supports explicit `--local`, `--output-dir`, `--overwrite` and shared `--strict-coverage`; sync supports `--no-apply` and shared `--strict-coverage`. No `sync --check` flag exists in the verified interface. Global `--yes` may apply changes; check tooling must use explicit `--no-apply` instead.

Add to the tracked config:

```toml
[experimental.pgdelta]
enabled = true
```

The historical renewal migration calls `net.http_post`. Current adoption docs require shadow webhook support for migration histories using `pg_net`, so add `[experimental.webhooks]` with `enabled = true` if required by the documented gate. This supports shadow preparation, not deployment of a new live webhook. Preserve all runtime service settings and Postgres 15. Leave `schema_paths` absent; current `pg-delta` orders dependencies itself. Keep the existing CLI version unchanged.

**Verify:** the two help commands expose the required flags; `pnpm db:verify --check-types` still passes under the new config with no migration/type changes. Stop if the config introduces a runtime feature change beyond these documented shadow/engine settings.

### 2. Export the complete clean baseline and require an initial no-op

Start a fresh replay with `pnpm db:verify --keep --check-types`. Set `DB_VERIFY_WORKDIR` to its owned path. After confirming that run passed, reset that owned local DB once more to full migrations and seeds, before running lint/tests again, so any helper extensions installed solely by verification are removed from the export source. Verify its migration versions, then capture its catalog and migration/source-file checksums. Generate from this disposable DB directly into the new desired directory:

```bash
pnpm exec supabase --workdir "$DB_VERIFY_WORKDIR" db reset --local
pnpm exec supabase --workdir "$DB_VERIFY_WORKDIR" db schema declarative generate --local --output-dir "$PWD/supabase/schemas" --overwrite --strict-coverage
```

Use no schema filter initially: export the complete application-owned scope with supported auth/storage/realtime customizations and extension declarations. Keep the engine's per-object/per-schema layout, `_cluster` output and any default-privilege overlay files such as `adp_wipes.sql`. Do not flatten or rewrite the tree for style; dependency ordering and overlay semantics matter. Extension-owned PostGIS/platform internals must not become copied application tables/functions. Lint/pgTAP helper extensions introduced solely by verification must not become desired application dependencies; distinguish these by the pre-verification replay, not by deleting arbitrary unfamiliar extensions.

Review the export against the catalog inventory. Inspect generated role/config/trigger files for embedded credential literals without printing them. Secrets, password material or webhook authorization values are blockers; report file/line and credential type only. The output should contain definitions and supported extension configuration, not table data, PIX payloads, local personas or Vault secret rows.

Copy the desired tree into the disposable verifier workdir and run `db schema declarative sync -f verify_noop --no-apply --strict-coverage` there. Compare migration filename/content checksums before and after. Require no new or changed migration files. An exit 0 alone is insufficient: sync can successfully write a nonempty migration.

**Verify:** the export completes with strict coverage; inventory matches intended object ownership; initial sync changes zero migration files; every historical migration checksum in the checkout remains unchanged. If sync proposes drops, permission changes or any other unexplained SQL, stop and identify the missing declaration or engine limitation before proceeding.

### 3. Independently reconstruct the desired schema and compare catalogs

Implement `scripts/check-declarative-schema.mjs` and a root `db:schema:check` command. Reuse the isolated-workspace machinery, not the developer's DB. Its real-path algorithm is:

1. Create an owned copy of current migrations/config/seeds/tests/schemas. Fresh replay all migrations and seeds. Collect the baseline catalog **before** lint/test tooling installs helper extensions, then run all SQL tests plus complete type parity. If reusing a workspace whose tests already ran, reset it first and collect the catalog before running them again. Stop that owned stack before starting another if memory is limited.
2. Create a second, uniquely identified owned project with the same platform config/major version but an **empty migration directory** and disabled seeds in its copy only. Include the complete desired schema tree. Start the fresh platform database. Generate a full baseline there using `sync -f declared_baseline --no-apply --strict-coverage`; assert it actually creates one or more SQL migration files. Apply those generated files locally with `migration up --local`. They are verification artifacts and never enter the checkout.
3. Query the reconstructed catalog and compare it with the replay catalog using the existing comparator. Apply only the already-documented normalization for environment identifiers/ports and platform bookkeeping. Application default privileges, effective grants, owner semantics, auth customizations, function attributes and job definitions must match.
4. Run the critical schema-contract pgTAP file introduced in Step 4 against the reconstruction. This is schema equivalence, not a promise to reconstruct historical data from DDL. The `festival_companion_config` singleton and other DML remain supplied by the retained migrations/seeds on normal resets; do not fabricate those rows in desired SQL to make this test path look like full replay.
5. In a fresh copy with the **original full migration history**, run no-op sync against the committed declarations. Snapshot the copied migration directory and fail on any new/changed file. Preserve and report the offending SQL artifact path in owned temp state without applying it. Always clean owned resources and propagate failures.

Define `--keep` only for retaining the checker's owned failure artifacts. Never add a linked/custom-URL target. Include stable phase names, compared-object counts, actual executed SQL test counts and failure object identities in nonsecret output. `db:schema:check` succeeds only if all phases succeed; it must not rewrite the caller's schema or migration directories.

**Verify:** `node --test scripts/check-declarative-schema.test.mjs` passes. Cover strict command argument selection (`--local`, `--no-apply`), no-op returning 0 while writing a migration, multiple generated migration files, preservation of checkout inputs, and owned-resource cleanup on an intermediate failure. Then `pnpm db:schema:check` must pass on real disposable databases, including independent reconstruction/catalog comparison.

### 4. Add critical behavior assertions and prove the checker detects drift

Create `supabase/tests/schema_contract_test.sql` using the existing pgTAP transaction pattern. Keep assertions focused on conversion risks:

- Custom `auth.users` signup trigger calls `public.handle_new_user` and is enabled. A synthetic auth-user INSERT produces the corresponding profile, preserving empty search path and existing profile conflict behavior. This transaction rolls back.
- `prepare_association_account_deletion(uuid)` is not executable by anon/authenticated and is executable by service_role. Existing billing tests continue to verify admin/owner behavior and retained-record privacy.
- Intended RLS is enabled on billing, entitlement and companion tables; effective write privileges on formal ledger tables remain restricted. Assert current intent, not a new universal policy model.
- The three festival schedule tables retain FULL replica identity and membership in `supabase_realtime`.
- Exactly the three intended named festival cron jobs are present with their expected schedules/functions, with retired renewal/contribution jobs absent. Assert only application-owned jobs if future unrelated platform jobs exist.
- Current webbing snapshot CHECK and partial registration-key unique index exist.

The file must pass both on historical replay and desired-only reconstruction without needing seeded application rows. Run the other existing SQL suites on the normal seeded replay. Do not weaken them to accommodate the new path.

Perform two isolated probes and record their output in notes:

1. **Negative parity probe:** remove one owner policy declaration in a copied desired tree. The no-op/drift check must exit nonzero and identify generated changes. The source tree is untouched; the proposed policy drop is never applied.
2. **Authoring-loop probe:** in another owned copy, add a comment inside the dollar-quoted body of `public.is_valid_billing_timezone(text)` and sync. Its original definition is at `20260823144005_association_billing_cutover.sql:2642`: SQL/STABLE, SECURITY DEFINER, empty search path, `select exists` over `pg_catalog.pg_timezone_names`. Require a migration limited to replacing that function plus any necessary preservation of its existing metadata/ACLs. Apply locally, verify return values and unchanged effective permissions, then run sync again and require no further migration. This proves editing an existing function works without persisting a product change.

The probes remain temporary, and their generated migrations are never committed. If the engine emits unrelated/destructive changes, treat the probe as failed, not successful because the desired function appears somewhere in the output.

**Verify:** `pnpm db:schema:check` passes the unmodified tree; each probe produces its specified success/failure; `pnpm db:verify --check-types` passes all SQL suites, now including the new contract file. Migration/type checksums in the checkout are unchanged.

### 5. Make the workflow mandatory and document operational boundaries

Add `pnpm db:schema:check` as a required job step in the existing verification workflow and include desired SQL/verification script paths in triggers. Reuse the same pinned CLI and cloud-credential-free setup. Avoid redundant full replay work where the checker can reuse a verified owned baseline, while keeping the independent declared reconstruction. Record local runtime once; no CI-speedup project is part of this plan.

Rewrite the Supabase README around this exact everyday contract:

```text
Edit supabase/schemas/<object>.sql
pnpm exec supabase --workdir . db schema declarative sync -f <name> --no-apply
Review generated SQL for destructive changes and privileges
Apply to the intended local development stack with migration up --local
Regenerate complete types and run isolated db:verify --check-types plus db:schema:check
Commit desired SQL, reviewed migration and resulting full types together
Release migrations through the established deployment process
```

Explain that editing Studio does not update desired files, `db diff` is not the pg-delta declarative generation command, and refreshing declarations alone does not repair migration history. Preserve forward-only history. Renames, enum/data conversions and destructive changes require reviewed manual migration strategy rather than blindly applying drop/add output.

Document ordinary DML, bucket rows, singleton configuration data, Vault values and environment-specific webhook provisioning separately. Named cron jobs are supported extension configuration, so keep their desired definitions in the generated tree if the round-trip proves support. Correct the retired renewal/Vault instructions: the cleanup migration already exists, and the final model has no renewal job. Keep local seed order and manual PIX instructions intact.

**Verify:** run `node --test scripts/verify-database.test.mjs scripts/check-database-catalog.test.mjs scripts/check-declarative-schema.test.mjs`, `pnpm db:verify --check-types`, and `pnpm db:schema:check`, matching the workflow. `git diff --exit-code -- supabase/migrations packages/database/database-generated.types.ts supabase/seed.sql supabase/seeds` exits 0 relative to the starting checkout. Root workflow contains no cloud deployment/link/repair/reset target.

## Done criteria

- [ ] Complete desired SQL tree is generated from verified migration replay under exactly CLI 2.121.0.
- [ ] Root engine settings are limited to the documented declarative/shadow support changes.
- [ ] Initial and CI no-op syncs create/change no migration files.
- [ ] Independently reconstructed declarations match replayed application catalogs, including security/operational metadata.
- [ ] Critical contract tests pass on both paths; all existing SQL tests pass on seeded replay.
- [ ] Negative policy probe fails and the existing-function authoring probe succeeds without unrelated SQL.
- [ ] Complete generated types remain unchanged and match replay.
- [ ] No historical migration, seed, application source, hosted object or credential is changed/copied into the conversion.
- [ ] CI/docs enforce the new workflow; notes record limits, artifacts, counts and cleanup.

## STOP conditions and recovery

Stop on missing prerequisite evidence, unsupported application objects under strict coverage, dependency cycles, missing managed-schema customizations, leaked credential literals, unexplained export/sync SQL, mismatched ACLs/jobs/function attributes, or a checker that needs to erase semantic differences to pass. Record raw error text with secrets redacted and the exact command/version. Two focused fixes are enough before returning a concrete blocker; do not replace the engine or redesign the schema silently.

If strict coverage identifies an unsupported application object, use the official `_custom/` and versioned-migration guidance to formulate a separate scoped resolution. Preserve its dependency ordering and delivery history; do not suppress the coverage warning and declare this conversion verified.

Recovery before deployment is local: abandon the conversion changes while preserving predecessor work and clean only owned verification resources. Existing migration history and databases remain intact. If operators later deploy any real generated migration, recovery must be a reviewed forward migration; this plan does not authorize resetting or rewriting hosted history.

## Maintenance and references

Review future PRs as a pair: desired-state diff explains the intent; migration SQL explains the data-preserving transition. Keep manual DML migrations even when their resulting tables are declared. Update the focused contract tests only when an intentional product/security decision changes the asserted behavior.

- [Declarative workflow and caveats](https://supabase.com/docs/guides/local-development/declarative-database-schemas)
- [Engine selection and switching](https://supabase.com/docs/guides/local-development/diff-engines)
- [Pinned export flags and default-privilege overlays](https://github.com/supabase/cli/blob/v2.121.0/apps/cli/src/commands/db/schema/declarative/generate/generate.command.ts)
- [Pinned sync flags and apply behavior](https://github.com/supabase/cli/blob/v2.121.0/apps/cli/src/commands/db/schema/declarative/sync/sync.command.ts)
- [Destructive rename warning](https://supabase.com/blog/declarative-schemas-2-0-pg-delta)
