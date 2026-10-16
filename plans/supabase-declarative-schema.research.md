# Supabase schema workflow advisory

Researched October 16, 2026 against commit `427007b`. Status: advisory research; the user selected all three handoffs, now specified in Plans [002](002-supabase-verification-foundation.md), [003](003-supabase-baseline-and-types.md), and [004](004-supabase-declarative-adoption.md). No application source, migrations, configuration, or database objects changed during advising/planning.

## Recommendation

Adopt declarative schemas, after establishing database verification and selecting a reproducible baseline. Choose the current `pg-delta` workflow, with a pinned CLI, rather than introducing the legacy `migra` declarative workflow.

The benefit here is concrete: the repository contains 41 SQL migrations totaling 13,839 lines. The billing cutover is 6,385 lines and its staging reconciliation is another 3,130. Functions such as `get_highline` and `book_festival_schedule_slot` have several historical definitions. A desired-state tree would let contributors change and review the current function definition in one place, while generated migrations continue to deliver changes.

Preserve all existing migrations. Declarative files become the authoring source; versioned SQL remains the deployment history. Data transformations still require deliberate migrations. This change does not require an ORM, an application data-layer rewrite, or a Postgres major-version upgrade.

## What was verified

- TypeScript/pnpm monorepo with Expo mobile, Next.js web, shared UI and database packages. Node is pinned to 24.18.0 and pnpm to 11.10.0.
- No checked-in `supabase/schemas/` tree or `[experimental.pgdelta]` configuration. The configured Postgres major version is 15.
- System CLI is 2.67.1. The repository-installed CLI and lockfile resolve to 2.83.0; `packages/database/package.json:10` allows `^2.62.10`. The system and package CLIs expose different commands.
- Local catalog records all 41 migrations, with 39 public tables and 82 public functions.
- The linked hosted project is **staging**, not production. Read-only metadata queries found 40 recorded migrations, Postgres 15.8, 38 public tables and 82 public functions. It lacks `20261015013845_webbing_catalog_snapshot.sql`. That is a pending deployment, not evidence by itself of broken migration history.
- Local additionally contains `public.profile_isa_accounts`. No checked-in migration references it, and staging does not contain it. This may be ongoing work. Its ownership must be resolved before using the local database as an export authority; do not delete it or silently include it in this adoption.
- Twelve pgTAP files cover billing, retention, claims, departures, push tokens, entitlements, festival companion and webbing behavior. Tests include owner/outsider authorization checks, not just object existence.
- Fresh type generation to stdout succeeded. Compared with the tracked file, it produced 207 added and 14 removed lines. Some differences reflect the local-only object, so this is not a patch to copy wholesale. Independently confirmed omissions include the checked-in entitlement and festival companion tables and companion registration RPCs.
- Staging has the three expected active festival cron jobs. No notification-table trigger was found in either inspected catalog. This is an operational inventory observation, not proof that all push delivery is broken.

## Vetted findings

Effort means S = hours, M = roughly a day, L = multiple days, including verification. Risk describes the proposed change. All findings below have HIGH confidence in the stated observation.

| Priority | Finding and impact | Category | Effort | Risk | Evidence |
| --- | --- | --- | --- | --- | --- |
| 1 | Database verification is absent from root GitHub Actions. Existing SQL regressions cannot gate schema changes through the checked-in workflows. | Verification | M | Low for verification; deployment activation must remain separate | `next/.github/workflows/ci.yaml:1`; `.github/workflows/react-doctor.yml:1`; `.github/workflows/check-translations.yml:1`; `supabase/tests/account_deletion_retention_test.sql:494` |
| 2 | Current local, staging and committed state are not interchangeable export baselines. Blind export risks importing unrelated work or omitting the pending webbing change. | Schema consistency | M | Medium; incorrect reconciliation can drop objects or misrecord deployments | Local/staging catalog observations above; `supabase/migrations/20261015013845_webbing_catalog_snapshot.sql:7`; historical environment divergence documented at `supabase/migrations/20260826180000_reconcile_association_billing_stage.sql:5` |
| 3 | CLI selection and generation entry points differ. The package script redirects into the tracked file before generation succeeds; the root helper uses a temporary file but whichever CLI is on PATH. | Tooling | S | Low | `packages/database/package.json:7`; `packages/database/package.json:10`; `pnpm-lock.yaml:665`; `supabase-gen-types.sh:7`; `supabase-gen-types.sh:21` |
| 4 | Shared generated types omit already-migrated objects. The course entitlement route also creates an unparameterized client, bypassing the missing contract. | Type correctness | M | Medium; proper regeneration may reveal hidden application errors | `supabase/migrations/20260914225134_add_choosen_course_entitlements.sql:1`; `supabase/migrations/20260730140837_festival_live_companion.sql:4`; `plans/001-hosted-slackdata-webbings.notes.md:7`; `next/app/api/courses/highline-beginner/access/route.ts:16` and `:63` |
| 5 | Operational onboarding still describes retired renewal/Vault requirements and says a cleanup migration is needed even though one exists and staging has applied it. | Documentation | S | Low | `supabase/README.md:88`; `supabase/README.md:99`; `supabase/migrations/20260826180000_reconcile_association_billing_stage.sql:247` |

GitHub requires workflows in the repository-root `.github/workflows` directory. The nested database CI also generates `types.gen.ts`, rather than the shared checked-in artifact, and checks it with `git diff`, which does not detect a newly untracked file. It needs replacement, not just relocation. Do not move the nested production/staging deployment YAMLs as part of adding verification. [GitHub workflow syntax](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax#about-yaml-syntax-for-workflows)

## Why the current declarative workflow fits

Supabase's October 13 announcement describes the newer implementation and recommends CLI 2.119 or later. The current release checked for this audit is 2.121.0. Pin and validate one release for local contributors and CI; the repository's older experimental commands should not be treated as equivalent. The engine remains pre-1.0 under experimental configuration. [Supabase announcement](https://supabase.com/blog/declarative-schemas-2-0-pg-delta), [CLI 2.121.0 release](https://github.com/supabase/cli/releases/tag/v2.121.0)

On the current engine, `db schema declarative sync` compares desired files with replayed migrations. `db diff` compares a live database with migrations and does not generate changes from the desired files. Automatic dependency ordering replaces legacy `schema_paths` ordering. This matters for this project's dependent billing functions and auth trigger. [Diff engines guide](https://supabase.com/docs/guides/local-development/diff-engines)

After the prerequisite work, use `supabase/schemas/`, initially keeping the export's per-object organization. For example, `public/functions/get_highline.sql` can hold the current definition. Organize for navigation without manually reordering historical SQL into a new baseline. Under a validated current CLI, the intended authoring loop is:

```text
Edit the desired SQL object in supabase/schemas/
Generate with: supabase db schema declarative sync -f <change> --no-apply
Review the migration, including permissions and destructive statements
Apply and test in a disposable local stack
Commit desired SQL and the reviewed migration together
Deploy migrations through the established release process
```

These are future workflow recommendations, not commands executed during this audit. A schema change made directly in Studio does not enter this authoring loop automatically. The initial conversion should produce no unexplained semantic migration. [Declarative schemas guide](https://supabase.com/docs/guides/local-development/declarative-database-schemas)

## Project-specific boundaries

The first baseline should cover the complete intended application schema. Start from a clean replay of committed migrations in a separate local stack, then compare it with staging. Investigate differences instead of accepting whichever database was exported last. Do not begin with a partial public-schema snapshot that makes unrepresented objects look intentionally removed.

Require parity for table constraints, indexes, RLS flags and policies, effective function EXECUTE permissions, default privileges, function signatures, definer/invoker settings, `search_path`, triggers, Realtime publication membership and replica identity. Existing billing grants and revocations are deliberate. Representative evidence is `supabase/migrations/20260823144005_association_billing_cutover.sql:4572`, with grants beginning at `:4633`. The signup trigger is on `auth.users`, outside `public`, at `supabase/migrations/20250605202359_handle_new_user_trigger.sql:14`. Festival publication membership is at `supabase/migrations/20260429120000_festival_queue.sql:1020`.

Keep backfills, data conversions and deployment-specific provisioning explicit. The staging reconciliation's association-person backfill at `supabase/migrations/20260826180000_reconcile_association_billing_stage.sql:808` is operational history, not desired-state DDL. Preserve local personas as seeds and keep bucket rows separate from schema objects. Current docs explicitly exclude ordinary DML from schema diffs and distinguish managed objects from application customizations. [Declarative schema caveats](https://supabase.com/docs/guides/local-development/declarative-database-schemas#known-caveats)

Named cron jobs are a supported exception: current `pg-delta` can model them through extension APIs. Preserve exactly the three current festival jobs and verify their commands/schedules during conversion. Do not resurrect the removed renewal, contribution-reminder or billing-generator jobs. Inventory webhook provisioning without exporting credential values. [Extension configuration support](https://supabase.com/docs/guides/local-development/declarative-database-schemas#extension-managed-objects)

Review generated renames and type changes manually. The current engine can represent a column rename as drop/add, losing data if applied unchanged. Desired state cannot express how existing rows should transform. [Supabase's migration warning](https://supabase.com/blog/declarative-schemas-2-0-pg-delta)

## Selected implementation-plan packages

The user selected all three packages on October 16, 2026. The numbered files linked above are the authoritative executor plans; the descriptions below preserve the audit's recommendation.

1. **Verification and tooling foundation**, findings 1 and 3. One pinned CLI, one safe generation entry point, a root verification-only workflow, full migration replay, SQL lint and all 12 pgTAP files. Keep deployment activation out of scope.
2. **Baseline and generated-contract reconciliation**, findings 2 and 4. Resolve local-only work and intended deployment state, compare clean replay with staging, regenerate the full shared type artifact and type the entitlement client. Preserve the custom `MergeDeep` overrides in `packages/database/index.ts:17`.
3. **Declarative authoring adoption**, dependent on both packages. Export the complete reconciled state, verify security/operational parity and an initial no-op sync, then demonstrate one small existing-function edit. Update onboarding, including finding 5. Estimate L with medium change risk until parity gates pass.

Recommended order is 1, then 2, then 3. Baseline investigation can overlap foundation work, but adopting the authoring workflow must wait for both. The conversion's scope should preserve behavior; unrelated policy hardening, storage retirement and billing redesign belong elsewhere.

Future verification should use an isolated stack and run from the repository root. Candidate gates, to confirm against the pinned CLI before writing an execution plan, include:

```bash
pnpm exec supabase --workdir . db reset --local
pnpm exec supabase --workdir . db lint --local
pnpm exec supabase --workdir . test db supabase/tests
pnpm --filter chooselife-web test
pnpm --filter chooselife-web exec tsc --noEmit --incremental false
pnpm --filter chooselife-mobile exec tsc --noEmit --incremental false
pnpm --filter @chooselife/ui exec tsc --noEmit --incremental false
```

The eventual plan also needs explicit checks that regenerated types match the complete artifact and that the desired schema matches migration replay. Do not invent a `sync --check` flag. Check the pinned CLI and compare output in disposable state. Existing notes at `plans/001-hosted-slackdata-webbings.notes.md:49` document a test-path/workdir pitfall; a successful command that discovers zero SQL tests is not a pass.

## Considered and rejected

- Duplicate generated schemas across clients: the web/mobile files are re-exports, as is the Edge shared type file. Keep the existing shared package.
- Missing meaningful SQL tests: false. The execution gate is missing; the tests already cover important authorization and retention behavior.
- An unfixed dead renewal cron: false for the committed final chain and inspected staging state. Correct the stale README instead.
- Missing Storage policies as an established active upload bug: not demonstrated. Current app media flows use R2; inventory legacy buckets before altering them.
- Squashing or rewriting applied migrations: unnecessary and risks repeating environment divergence already documented by the staging reconciliation.
- Blindly activating nested deployment workflows: changes remote-write behavior and is unnecessary for schema authoring adoption.

## Limits

No database reset, migration application, pgTAP run, CLI upgrade, install, schema export to tracked files, production inspection, application build or general runtime security/performance audit was performed. Local and staging observations were read-only catalog/migration metadata queries. The existing local database having 41 migration records does not prove a fresh replay succeeds. A fresh generated type comparison proves current drift, not that a full type update will compile.

The relevant changelog index and current official documentation were checked. No credentials or application row contents were collected for this report. Existing untracked Next.js instruction files were left untouched.
