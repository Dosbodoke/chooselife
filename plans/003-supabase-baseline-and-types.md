# Plan 003: Reconcile the Supabase baseline and restore complete generated types

> This plan is self-contained. Read it fully, verify the prerequisite contract, and execute in order. Write `plans/003-supabase-baseline-and-types.notes.md` with `## Deviations` and `## How the run ended`. Update this plan's index row when finished. All database writes in this plan target disposable local projects; staging inspection is read-only.

## Status

- Priority: P1
- Effort: M, potentially L if comparison reveals undocumented schema changes
- Risk: MED
- Depends on: Plan 002, isolated verification and pinned tooling
- Category: migration, correctness, dx
- Planned at: commit `427007b`, October 16, 2026
- Execution status: RECONCILIATION BLOCKED at003.3 with named same-version differences. Checkpoints003.1–003.2 are accepted. The diagnostic report is accepted after parent verification and fresh Sol round2 SHIP at `c2b1ff1`; the restored full replay passes371SQLassertions. Independent003.4 is accepted after parent verification and fresh Sol SHIP at `f1cc1cd`;003.5 local CI/catalog integration is next under the refinement below. Plan004 remains gated by reconciliation.

## Outcome and decisions

Make migration replay the reproducible schema authority and regenerate the **entire** shared TypeScript artifact from that authority. Compare staging at its recorded migration version, so a pending deployment is distinguished from an unexplained change. Preserve ongoing local work without importing it into this baseline accidentally.

Do not deploy the newest migration to staging as part of this plan. A documented staging deployment lag is acceptable when the staged version agrees with a replay at the same version. Undocumented semantic drift must be resolved or reported before declarative adoption.

User scope decision, October17: "No need for staging rules. I currently migrated to R2 storage." R2 is the active storage backend. Legacy Supabase Storage bucket IDs, bucket existence and MIME configuration, previously B1, are retired operational configuration outside this reconciliation target. Do not reproduce them in new migrations or desired schema, and do not change hosted bucket data as part of this work. Existing catalog captures remain historical evidence, including B1; this decision does not silently change the checker or approve unrelated grants, policies or platform security differences. B2 schema `public` ACL and B3/other security provenance remain unresolved. Any future parity-scope implementation must express this narrow target explicitly and receive fresh review.

## Prerequisite contract and drift check

Plan 002 must have delivered all of the following, regardless of whether its document is available:

- Repository-installed CLI exactly 2.121.0, Node 24.18.0, pnpm 11.10.0.
- `pnpm db:verify [--keep] [--check-types]`, which owns a unique disposable stack and does not modify the developer's stack. `--keep` prints a nonsecret workdir/project descriptor and cleanup command.
- `bash supabase-gen-types.sh [--check] [--workdir <root>] [--output <path>]`, backed by the repository CLI. It generates all `storage,public,functions` types, uses atomic replacement, and never writes the artifact in check mode.
- Root `db:types`, `db:types:check`, and a verification-only `.github/workflows/database.yml`. Full type drift is not yet blocking CI.

Verify this contract using `pnpm exec supabase --workdir . --version`, `node --test scripts/verify-database.test.mjs`, and `pnpm db:verify --keep`. If absent or failing, stop rather than recreating the predecessor's work.

Run:

```bash
git status --short
git diff --stat 427007b..HEAD -- packages/database supabase-gen-types.sh scripts .github/workflows/database.yml next/app/api/courses/highline-beginner/access/route.ts supabase/migrations supabase/config.toml
```

Changes implementing the prerequisite are expected, not drift failures. Reconcile other changes against this plan's assumptions before editing. In particular, a newly committed ISA integration migration changes the expected schema and must be included in the clean replay instead of excluded by an old name-based rule.

## Current state and intent

- One generated source lives at `packages/database/database-generated.types.ts`. Mobile `expo/utils/database.types.ts:1` and web `next/utils/supabase/database.types.ts:1` re-export the shared package. `supabase/functions/_shared/database.types.ts:1` re-exports the generated source directly. These are not separate generated copies.
- Full generation from the inspected local DB produced 207 added and 14 removed lines. That number is diagnostic, not an expected patch size: the local DB also has an unpublished object.
- `plans/001-hosted-slackdata-webbings.notes.md:7` records that only the generated webbing block was spliced into the previous update; unrelated type drift was deferred.
- `supabase/migrations/20260914225134_add_choosen_course_entitlements.sql:1` creates:

  ```sql
  create table public.choosen_course_entitlements (
    user_id uuid primary key references auth.users(id) on delete cascade,
    created_at timestamptz not null default timezone('utc'::text, now())
  );
  ```

  Its RLS policy allows authenticated owners to SELECT, with write grants revoked. Keep this authorization model.
- `supabase/migrations/20260730140837_festival_live_companion.sql:4` and `:21` create `festival_companion_config` and `festival_companion_tokens`. Those tables and `register_festival_companion_token` / `unregister_festival_companion_installation` are missing from the committed type artifact at the planned revision. The registration RPC is defined at line 65; its name was corrected during Step 1 inspection.
- `next/app/api/courses/highline-beginner/access/route.ts:15` currently has:

  ```ts
  function createRlsSupabaseClient(accessToken: string) {
    return createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
      { /* session persistence disabled; bearer Authorization header */ }
    );
  }
  ```

  It queries `.from("choosen_course_entitlements")` at line 63. Parameterize that client after restoring the table type. Match the existing shared `Database` use in `next/utils/supabase/server.ts:9`.
- `packages/database/index.ts:17` defines `Database = MergeDeep<DatabaseGenerated, ...>`, overriding PostGIS POINT and localized notification JSON shapes. Preserve these overrides; regeneration updates only the generated file.
- The application uses manual PIX obligations, user payment claims and atomic admin decisions. Account deletion preserves formal association records with admin-only access. Baseline reconciliation must preserve these behaviors; it is not a billing redesign.

Read-only observations on October 16, 2026:

| Environment | Migration state | Relevant observation |
| --- | --- | --- |
| Developer local | 41 versions through `20261015013845` | Contains `profile_isa_accounts`, absent from checked-in migrations at this revision |
| Linked hosted project, `festival-chooselife-stage` | 40 versions through `20261014162921` | Lacks the new webbing snapshot migration; has the three expected festival cron jobs |

These are stale-able observations, not targets to force. No production inspection occurred. A staging history count alone is not schema equivalence. The reconciliation migration explains historical environment divergence at `supabase/migrations/20260826180000_reconcile_association_billing_stage.sql:5`; preserve that history.

## Scope and git workflow

Modify only:

- `supabase/verification/catalog.sql` to create
- `scripts/check-database-catalog.mjs`, `scripts/check-database-catalog.test.mjs` to create
- `scripts/verify-database.mjs` and its tests, limited to integrating catalog/type verification
- `packages/database/database-generated.types.ts`
- `packages/database/index.ts`, limited to the trigger-backed optional `highline.Insert.slug` override and its explanation, preserving all existing overrides and re-exports
- `supabase-gen-types.sh` and new `scripts/supabase-gen-types.test.mjs`, limited to canonical Prettier formatting and verification of its failure-preservation contract
- `next/app/api/courses/highline-beginner/access/route.ts`
- `.github/workflows/database.yml`, `package.json`, and `supabase/README.md` for the new check commands/documentation
- Minimal type-only fixes in direct generated-type consumers under `packages/ui/src/`, `expo/`, or `next/`, **only** for new errors demonstrated by the before/after typechecks. Record each such file, diagnostic and fix in the notes before editing it.
- The plan index and this plan's notes

Do not change SQL migrations, seeds, root Supabase config, privileges, application behavior, cloud state, storage providers or unrelated dependencies. Preserve the re-export structure and `MergeDeep` overrides. Never add `any`, unchecked casts, `@ts-ignore`, or an untyped client to hide an incompatibility revealed by regeneration.

Use a branch based on completed Plan 002, for example `advisor/003-supabase-baseline-types`. Match conventional commits such as `fix(db): regenerate complete database types`. Push/PR/deployment follows separate operator instructions.

## Steps

### 1. Capture a clean migration baseline and compiler baseline

Run `pnpm db:verify --keep`; retain its owned descriptor. Set a task-specific shell variable `DB_VERIFY_WORKDIR` to the exact printed absolute workdir. Use this only for the disposable project, and verify its `chooselife-verify-` ownership marker before each reset. Capture baseline diagnostics from the web, Expo and shared UI typechecks listed below before changing types.

Inventory checked-in migration filenames and actual applied versions. `profile_isa_accounts` should be absent from a fresh replay at this revision. If it now has a checked-in migration, accept the new committed state and document the drift. If it appears without a migration in the disposable replay, identify the source of contamination and stop; do not create a migration merely to match an unrelated developer database.

**Verify:** `pnpm db:verify --keep` passes; local metadata returns exactly the checked-in versions; `rg -n profile_isa_accounts supabase/migrations` has no matches at the planned revision. Record the clean table/function inventory, not application rows.

### 2. Implement reusable, nonsecret catalog comparison

Create a read-only `supabase/verification/catalog.sql` returning one JSON result. It must work via both local CLI and the Supabase read-only SQL connector. Keep credentials, user rows and data values out of the output. Capture these application-owned semantic facts, with stable object identities and sorted arrays:

- Tables/columns, type names, nullability, defaults, generated/identity settings, constraints, indexes, sequence **definitions** and comments. Exclude sequence current values and table contents.
- Enum labels in semantic order, non-extension domains, and application function signatures, return types, language, volatility, definer/invoker flag, configuration such as `search_path`, and a digest of the body/definition. Normalize CRLF only; do not normalize away security-relevant SQL.
- RLS enabled/forced flags; policy command, roles, permissive/restrictive mode and expression digests.
- Direct table/column/schema/function ACLs and default ACLs expressed by role names, plus effective privileges for `anon`, `authenticated` and `service_role`. For `PUBLIC`, use ACL grantee zero through `aclexplode`; `PUBLIC` is not a normal login role for `has_function_privilege`.
- Triggers by schema/table/name, enabled state, called function identity and definition digest, including the custom `auth.users` trigger and custom managed-schema policies/triggers. Exclude Supabase's own platform objects and extension-owned objects using catalog ownership/dependencies, not a list of names to ignore.
- Application Realtime publication membership and replica identity.
- Extension names/versions/schema placement as environment metadata. Compare application semantics separately from harmless platform patch-version differences.
- Named cron jobs, their active flags, schedules, target DB/user and command digest. Exclude runtime run-history, networking port assignments and scheduling timestamps.

Include application objects in `public`, and application customizations in managed schemas. Detect additional non-managed schemas instead of silently ignoring them. Exclude migration bookkeeping and extensions/helpers installed only by lint or pgTAP verification from application comparison; establish their provenance by a fresh replay before verification tools run. Do not serialize raw function bodies or trigger arguments: a future webhook definition could embed credentials. Digests allow equality checks without printing those values.

Create `scripts/check-database-catalog.mjs <left.json> <right.json>` accepting the normalized JSON payload or CLI/connector result wrapper. Exit 0 for equality; exit 1 with only differing object identities/fields for semantic differences. Sort object collections without sorting ordered enum labels, columns, index keys or function arguments. Fail on malformed/truncated output, missing required sections and duplicate identities. Provide a `db:catalog:compare` root script. No broad ignore switch or version-specific drift allowlist.

Wrapper contract refined after the October 17 review: JSON payload strings are opaque data, including comments, defaults and configuration containing `<untrusted-data-…` text. Recognize the supported wrapper structure without scanning those strings as protocol. Apply connector delimiter/prose checks outside the framed JSON payload, and recognize JSON-lines events without interpreting their JSON strings as connector text. A bare catalog, CLI rows, connector text, connector `{result}` and stream-json must all accept the same valid payload. Explicit stream errors and malformed/additional boundaries outside the payload must still fail closed.

The original checkpoint exhausted two correction rounds and is blocked on the reproduced regression: setting a schema comment to `Documentation example: <untrusted-data-deadbeef` is valid in bare JSON but rejected in connector and stream wrappers. One bounded parser recovery under this refined contract may change only the comparator, its tests and notes. It must prove valid payload prefixes round-trip across wrappers while preserving every prior rejection case, then receive a new fresh Sol review. If that recovery fails, retain BLOCKED status and report the concrete remaining issue instead of starting another correction loop.

Recovery outcome: the ASCII case is fixed, but the final fresh review reproduced another valid JSON case. Raw U+2028 or U+2029 inside a payload string makes JavaScript multiline regex anchors recognize extra connector delimiter lines. Bare JSON accepts the same payload. The next parser proposal must distinguish physical connector framing from every character allowed in JSON strings, including these Unicode separators. The single recovery allowance is exhausted; no further implementation loop was started.

The user subsequently instructed the agent to proceed on October 17, explicitly resuming this blocked checkpoint. One new bounded task may correct physical LF/CRLF framing without interpreting U+2028/U+2029 inside JSON strings as protocol boundaries. Keep the prior opaque-payload, strict-input and security contracts. Add the two Unicode regressions across supported wrappers and verify LF/CRLF delimiters and malformed outer tags. Obtain a fresh Sol review before acceptance or pushing. This is a resumed task under new user authorization, not an extension of the exhausted prior loop.

**Verify:** `node --test scripts/check-database-catalog.test.mjs` passes. Fixture tests must detect a lost RLS policy, changed EXECUTE grant, altered function body, missing auth trigger, changed cron command and changed enum order; reordered unordered object arrays must compare equal. Include connector-wrapper and invalid-input cases, valid tag-like text inside payload strings across supported wrappers, and malformed tag prefixes outside the connector payload. Test fixtures contain synthetic metadata only.

### 3. Compare staging at the same migration version

Identify the currently linked project's name and migration history through read-only tools. Use `supabase/.temp/project-ref` as identification data, never copy it into the disposable project. If it identifies production or an unrelated project instead of staging, stop remote inspection and report the mismatch. If staging access is unavailable, finish independent local/type work but leave the reconciliation result BLOCKED or VERIFICATION PENDING with the missing comparison named.

Fetch only migration metadata and the catalog query result, using read-only `SELECT` through the connector or `db query --linked --file <absolute catalog.sql>`. No repair, pull, push, migration application or dashboard schema editing. Store outputs in an untracked temp directory; keep only nonsecret difference summaries in notes.

For the observed stage version, reset the **owned scratch** database to `20261014162921` with `--local --version 20261014162921 --no-seed`, collect its catalog, and compare with staging. This avoids treating the later webbing migration's two columns, CHECK, unique index, policy change and comments as unexplained drift. If staging has advanced, use its actual recorded version only after confirming its history is a matching prefix of checked-in migration versions. A missing middle migration or unknown remote version is a STOP condition.

The local read command, once `DB_VERIFY_WORKDIR` is verified, is:

```bash
pnpm exec supabase --workdir "$DB_VERIFY_WORKDIR" db query --local --file "$PWD/supabase/verification/catalog.sql" --output json
```

Check actual `db query --help` and machine-output shape on 2.121.0. Redirect catalog output to temp files, then run `pnpm db:catalog:compare <local.json> <stage.json>`. Investigate differences by identity. An independent application change, missing customization or privilege difference must be resolved by its owner or returned as a specific blocker, not normalized away.

Restore the scratch DB to all checked-in migrations **with** seeds before type generation and tests. Re-run the full SQL suite. Record the intended deployment lag explicitly; do not change hosted state to remove it.

**Verify:** same-version catalog comparison exits 0, or every remaining difference is a named blocker. Full replay is restored and applied versions equal checked-in versions. Notes distinguish this result from uninspected production.

### Independence refinement after003.3 findings

The same-version comparison identified legacy bucket configuration, a schema grant and platform security differences. Keep these named blockers visible and do not change migrations, hosted state or comparator semantics to force parity. The full local replay was restored and independently verified at41migrations with12SQLfiles/371assertions. That replay remains the type-generation authority. Step003.4 may therefore proceed independently, and003.5 may verify local type parity, while same-version reconciliation remains BLOCKED. Neither step closes the staging done criterion or authorizes Plan004. The user has decided that legacy Supabase bucket configuration is outside the target because storage migrated to R2. B1 is therefore a retired-scope difference rather than an outstanding preference; B2/B3 and other security provenance remain unresolved. A forward reconciliation migration requires its own reviewed scope.

### 4. Regenerate the whole artifact and type the entitlement client

Run the safe generator against the full replay, replacing the complete shared artifact:

```bash
bash supabase-gen-types.sh --workdir "$DB_VERIFY_WORKDIR"
bash supabase-gen-types.sh --check --workdir "$DB_VERIFY_WORKDIR"
```

Do not hand-splice blocks or copy output from the developer's existing database. Import the shared `Database` type into the entitlement route and change `createClient(` to `createClient<Database>(`. Keep bearer authorization, disabled session persistence, RLS, responses and R2 signing unchanged.

Scope refinement after the first003.4 attempt: the clean generated artifact correctly requires `highline.Insert.slug` because the column is NOT NULL with no default. The existing `set_highline_slug` BEFORE INSERT trigger unconditionally supplies it, so put `slug?: string` in the existing shared `MergeDeep` highline Insert override, with a short trigger explanation. Keep `Row.slug` required, all existing PostGIS/notification overrides and all re-exports unchanged. This corrects two demonstrated new errors in `next/components/CreateHighline.tsx:194` and `expo/components/highline/highline-form.tsx:226`, without changing either insert payload. The old generated file had the optionality hand-spliced; do not repeat that. The original task brief excluded the override file too narrowly.

The raw CLI output also has15trailing-whitespace lines and conflicts with the repository formatting command. Supersede the initial raw-output decision: normalize the entire generated stream with the already installed repository Prettier, currently3.8.1, before validation/comparison/atomic replacement. Keep `set -o pipefail`, existing nonempty/export validation, temp cleanup, output guards and0/1/2exit contract. A CLI failure after emitting valid partial output or a formatter failure must exit2 and preserve existing destination bytes in both write and check modes. Use a fixed canonical `--stdin-filepath` pointing to `packages/database/database-generated.types.ts`, and run only the formatter subprocess from repository root. Do not derive formatting configuration from `--output`, a scratch directory or the caller cwd; preserve relative output-path behavior. No new dependency, ignore file, generic formatting framework or SQL change is needed.

Add bounded tests in `scripts/supabase-gen-types.test.mjs` that execute the real shell helper with fixture executables. Cover canonical write/equality, destination/cwd configuration independence, drift preservation, partial-output CLI failure, formatter failure and temporary-file cleanup. The existing verifier tests replace the type helper and cannot verify these contracts. Check the real generated artifact with Prettier, show that formatting it again changes no bytes, and show generator `--check` still exits0. Keep failures and formatting tests independent of a live database.

Run the three consumer typechecks. Fix only new errors caused by accurate generated contracts, using real nullable/optional shapes and the existing shared override mechanism. Compare with Step 1's diagnostics. Runtime logic changes or errors unrelated to regeneration require a separate scope decision; report them instead of expanding this plan.

**Verify:** `rg -n 'choosen_course_entitlements|festival_companion_config|festival_companion_tokens|register_festival_companion_token|unregister_festival_companion_installation' packages/database/database-generated.types.ts` finds all five identities; the complete file check exits 0; all consumer typechecks exit 0.

### 5. Make complete type parity a blocking CI gate

Change `.github/workflows/database.yml` to invoke `pnpm db:verify --check-types` and include the new generator tests alongside the existing helper/catalog tests. Include workflow path triggers for direct type consumers, generated types and the safe generator. Keep the workflow verification-only and cloud-credential-free. Document full regeneration from clean replay and the stage comparison result in the README/notes.

Prove the gate rejects drift using a scratch `--output` file or disposable checkout: generate a valid artifact, change a field or append a sentinel, run `--check`, and assert nonzero exit with unchanged bytes. The production artifact must remain untouched by the negative test. Integrate the catalog JSON capture into verification as a reusable step for Plan 004; there is no checked-in dump of staging data.

**Verify:** `node --test scripts/verify-database.test.mjs scripts/check-database-catalog.test.mjs scripts/supabase-gen-types.test.mjs`, `pnpm db:verify --check-types`, and the application gates below all pass.

## Application gates

Prepare the ignored framework declarations before recording the compiler baseline or comparing generated database types. A fresh worktree lacks these files even when dependencies are installed. From the root, with Node 24.18.0 selected:

```bash
CI=1 NEXT_TELEMETRY_DISABLED=1 NEXT_PUBLIC_SUPABASE_URL=https://example.supabase.co node next/node_modules/next/dist/bin/next typegen next
cd expo
APP_VARIANT=development CI=1 EXPO_OFFLINE=1 EXPO_NO_TELEMETRY=1 node node_modules/expo/bin/cli customize tsconfig.json
cd ..
```

The URL is a nonsecret image-host configuration value for type generation, not a database target. These commands generate ignored `next/next-env.d.ts`, `next/.next/types/`, `expo/expo-env.d.ts` and `expo/.expo/types/`. Existing tracked framework configuration already includes them; confirm `git status --short` stays unchanged. Do not add ambient declarations, alter route types or suppress errors to replace framework generation. Direct installed entry points avoid pnpm 11's automatic dependency installation before `exec`. Record both the initial raw diagnostics and the prepared baseline before any database-type change, and compare the latter with the final diagnostics.

Run from the root and record exit codes:

```bash
pnpm --filter chooselife-web test
pnpm --filter chooselife-web exec tsc --noEmit --incremental false
pnpm --filter chooselife-mobile exec tsc --noEmit --incremental false
pnpm --filter @chooselife/ui exec tsc --noEmit --incremental false
pnpm --filter chooselife-mobile exec jest features/course-guide --runInBand --watch=false --watchman=false
```

The web suite already includes `lib/courses/highline-beginner-access.test.ts`. It verifies unauthorized, no-entitlement and permitted cases with injected dependencies. Existing `supabase/tests/choosen_course_entitlements_test.sql` verifies the real table/RLS. Use those tests rather than adding a test that merely asserts the generic type parameter exists.

## Done criteria

- [ ] Clean full migration replay and all SQL tests pass under the pinned CLI.
- [ ] Same-version staging comparison is complete with no unexplained semantic differences; pending deployment lag is documented.
- [x] The full generated file matches clean replay; no spliced blocks or unpublished local objects enter it.
- [x] Entitlement client uses the shared `Database` type and preserves runtime authorization behavior.
- [x] Consumer typechecks and targeted existing application tests pass.
- [ ] CI blocks complete generated-type drift; negative check proves it detects drift without writing.
- [ ] Notes list each consumer file changed and every allowed environment normalization; original local and all hosted objects remain unchanged.

## STOP conditions, recovery and maintenance

Stop on a missing predecessor contract, unknown/missing-middle remote migration, unexplained schema/ACL difference, contaminated scratch baseline, required migration or runtime-logic change, or newly required credentials that the available read-only connection does not supply. Preserve independent progress in notes; do not claim full reconciliation while the stage comparison remains unavailable.

Recover locally by regenerating again from a fresh owned replay and cleaning only the verifier's resources. Hosted recovery is unnecessary because this plan performs no hosted writes. Future feature migrations must regenerate the whole artifact and keep the blocking check green. The catalog comparator is intentionally an equality checker, not a migration planner.

## References

- [Pinned CLI query flags](https://github.com/supabase/cli/blob/v2.121.0/apps/cli/src/commands/db/query/query.command.ts)
- [Pinned CLI versioned reset flags](https://github.com/supabase/cli/blob/v2.121.0/apps/cli/src/commands/db/reset/reset.command.ts)
- [Supabase TypeScript generation](https://supabase.com/docs/guides/api/rest/generating-types)
- [Next type generation](https://nextjs.org/docs/app/api-reference/cli/next#next-typegen-options)
- [Expo typed-route generation without a development server](https://docs.expo.dev/router/reference/typed-routes/#type-generation)
