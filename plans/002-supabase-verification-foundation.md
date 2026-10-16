# Plan 002: Establish isolated Supabase verification and one CLI toolchain

> Execute this plan in order. Confirm each gate before continuing. Keep execution notes in `plans/002-supabase-verification-foundation.notes.md` and update this plan's row in `plans/README.md`. A missing Docker runtime or a failing historical migration is a blocker, not a passed check. Implementation is local and verification-only; hosted deployment is outside this plan.

## Status

- Priority: P1
- Effort: M
- Risk: MED for the CLI upgrade and first full replay; LOW for the verification-only workflow
- Depends on: none. Plan 001's remaining native checklist is unrelated.
- Category: tests, dx
- Planned at: commit `427007b`, October 16, 2026

## Outcome and decisions

Provide a reproducible root command that starts a disposable Supabase project, replays every checked-in migration and seed, lints application functions and runs every SQL test. Use the same exact CLI release in development and GitHub Actions. Preserve the developer's existing local database, including unpublished work.

Pin Supabase CLI `2.121.0`, the current release verified during planning, in the existing database package. The host CLI was 2.67.1, whereas the lockfile resolved 2.83.0. Current declarative documentation and flags target a newer implementation. Validate the pinned release's actual help before using it; do not silently substitute another version.

Type drift already exists. This plan implements a safe check command but does **not** make stale generated types a blocking CI check. Plan 003 regenerates the complete contract and enables that gate. This separation lets this plan land without knowingly introducing red CI or hiding type drift.

## Drift check and current state

Run from the repository root:

```bash
git status --short
git diff --stat 427007b..HEAD -- package.json pnpm-lock.yaml packages/database/package.json supabase-gen-types.sh supabase/config.toml supabase/migrations supabase/tests scripts .github/workflows supabase/README.md
```

Reconcile changed excerpts and existing files before editing. Preserve unrelated working-tree changes. `next/AGENTS.md` and `next/CLAUDE.md` were already untracked during planning.

Relevant evidence:

- `packages/database/package.json:6` currently has:

  ```json
  "scripts": {
    "gen-types": "supabase gen types typescript --local --schema storage,public,functions > database-generated.types.ts"
  },
  "devDependencies": { "supabase": "^2.62.10" }
  ```

- `supabase-gen-types.sh:20` already uses a temporary file, but selects the CLI from PATH and assumes the caller is in the root:

  ```bash
  supabase gen types typescript --local --schema storage,public,functions > "$TEMP_FILE"
  cp "$TEMP_FILE" "$PACKAGE_TYPES_PATH"
  ```

- Root `package.json` uses Node 24.18.0, pnpm 11.10.0, Turbo, and conventional script names. Its existing deployment command is `deploy:functions`; leave that behavior unchanged.
- `.github/workflows/` contains only translation and React Doctor checks. The database workflow at `next/.github/workflows/ci.yaml:18` uses `version: latest`, generates the wrong `types.gen.ts` artifact and checks it with `git diff`. Nested workflows are not discovered by GitHub.
- `supabase/config.toml:3` has `project_id = "chooselife"`; its service ports include API 54321, DB 54322, shadow 54320, Studio 54323, mail 54324, analytics 54327, pooler 54329 and Edge inspector 8083. A second workdir alone does not prevent port collisions.
- `supabase/config.toml:42` enables `./seed.sql` followed by `./seeds/association-billing-personas.sql`. Preserve that order.
- There are 41 migrations and 12 SQL test files at this revision. Derive expected counts from the checked-out tree rather than permanently hardcoding 41 or 12.
- Existing SQL tests use `begin;`, `select * from no_plan();`, role/JWT changes, `select * from finish();`, `rollback;`. See `supabase/tests/account_deletion_retention_test.sql:494` for real admin/outsider authorization checks.

## Scope and git workflow

Modify only:

- `package.json`, `packages/database/package.json`, `pnpm-lock.yaml`
- `supabase-gen-types.sh`
- `scripts/verify-database.mjs`, `scripts/verify-database.test.mjs` to create
- `.github/workflows/database.yml` to create
- `supabase/README.md`, limited to tooling and local verification setup
- The plan index and this plan's notes file

Historical migrations, SQL tests, seeds, application source, tracked generated types, root `supabase/config.toml`, declarative schemas and deployment workflows stay unchanged. Disposable copies of the configuration may be rewritten for isolation. If the new CLI needs a root config migration rather than accepting the existing file, stop and record the specific incompatibility.

Use a separate checkout/branch, for example `advisor/002-supabase-verification`. Match conventional commits such as `chore(db): add isolated database verification`. Commit/push/PR creation follows the operator's instructions; this plan does not authorize hosted deployment.

## Commands and prerequisites

The implementation requires Docker or OrbStack, Node 24.18.0 and pnpm 11.10.0. Installs below belong to execution, not the planning session.

| Purpose | Command | Expected result |
| --- | --- | --- |
| Install after editing the manifest | `pnpm install` | Lockfile changes only for the selected CLI and its dependency closure |
| Reproducibility | `pnpm install --frozen-lockfile` | Exit 0 |
| CLI | `pnpm exec supabase --workdir . --version` | Exactly 2.121.0 |
| Discover flags | `pnpm exec supabase --workdir . db lint --help` | Includes `--local`, `--schema`, `--level`, `--fail-on` |
| Discover lifecycle | `pnpm exec supabase --workdir . start --help` and `pnpm exec supabase --workdir . stop --help` | Local lifecycle available, including `--no-backup` on stop |
| Helper tests, after implementation | `node --test scripts/verify-database.test.mjs` | All tests pass |
| Full isolated verification, after implementation | `pnpm db:verify` | Migration replay, seeds, lint and every discovered SQL test pass |

## Steps

### 1. Pin the CLI and expose a safe type-generation command

Set `packages/database/package.json` Supabase dependency to exactly `2.121.0`. Keep it in that existing package; the repository uses a hoisted linker. Resolve the repository-installed CLI from the root, never the system executable or an unpinned `npx` download.

Extend `supabase-gen-types.sh` with this interface:

```text
bash supabase-gen-types.sh [--check] [--workdir <Supabase project root>] [--output <artifact path>]
```

Defaults are the absolute repository root and `packages/database/database-generated.types.ts`. Resolve these from the script's own location, so invocation from the package or another directory works. Always select the explicit local database. Pass `--schema storage,public,functions` exactly as the current generator does. Reject unknown options, `--linked`, and missing option values before invoking the CLI.

Generate into a temporary file, verify nonempty output with an exported `Database` type, and only then atomically replace the destination. Create the replacement temp file in the destination directory so rename is atomic. On failure or interruption the original artifact remains byte-for-byte intact. `--check` compares complete generated bytes with the destination, exits 0 on equality and 1 on drift, and never modifies the destination. Keep diagnostics separate from generated stdout. Clean up temporary files.

Make package `gen-types` delegate to this helper. Add root scripts `db:types` and `db:types:check` delegating to it, plus `db:verify` invoking the verifier created next. Preserve intentional type overrides in `packages/database/index.ts`; this step never regenerates the tracked file.

**Verify:** `pnpm exec supabase --workdir . --version` prints 2.121.0; `bash -n supabase-gen-types.sh` exits 0; a failed generation against a disposable invalid config preserves a sentinel `--output` file's checksum. Record the exact invocation and before/after checksum in the notes. Use scratch output, not the shared tracked artifact, for this failure test.

### 2. Build a disposable verification workspace

Implement `scripts/verify-database.mjs` with Node built-ins, following the repository's existing `.mjs` and `node:test` style. Avoid a new framework or dependency. Its public interface is:

```text
pnpm db:verify [--keep] [--check-types]
```

Requirements:

1. Create a unique directory with `fs.mkdtemp` under the OS temp directory and a `chooselife-verify-<unique>` project ID. Copy the working tree's migration, seed and SQL-test inputs, configuration, and required relative support files. Later plans will add `schemas/` and `verification/`; support copying those when present. Exclude `.temp`, `.branches`, real `.env` files and links, local caches, and any remote project-ref. Do not copy a broad directory recursively without exclusions.
2. In the copy only, allocate distinct available loopback ports for every enabled service and the shadow database; check that none are reused. Disable optional Studio, analytics and Edge runtime in the copy. Keep database, Auth, Storage, API and Realtime enabled. Preserve the database major version, migrations, seeds, auth defaults and SQL semantics. External providers stay disabled. A startup collision fails safely; it must not stop another project to free ports.
3. Validate the generated project ID and temp-root ownership before any reset or cleanup. CLI mutations always have `--workdir <absolute disposable root>` and explicit `--local` where supported. Never accept a hosted URL, linked target, caller-supplied workdir or `stop --all` through this verifier. Remove inherited Supabase cloud project/token/password variables and unused third-party provider credentials from verifier child environments; retain the runtime/Docker configuration needed to run the local stack.
4. Start the copied project, then explicitly `db reset --local` so every run proves a fresh replay including both seed files. Execute `db lint --local --schema public --level error --fail-on error`. Run `test db` from the disposable workdir with the test directory resolved explicitly; do not assume `--workdir` rebases positional test paths.
5. Count discovered migration and test files and compare applied versions with migration filenames using read-only local metadata. Assert a nonzero SQL test count and a nonzero executed assertion count, parsed from the pinned CLI's actual structured result or TAP summary. Select the output mode explicitly after checking its help; do not depend on automatic agent/TTY format detection. A CLI exit 0 with zero discovered tests or an unparseable execution count must fail.
6. `--check-types` invokes the safe generator in check mode against this disposable DB and the repository's tracked artifact. Until Plan 003, its known drift failure is expected and explicitly reported; default verification does not run it.
7. Clean up only resources belonging to this run, including on failure/signals, using `stop --no-backup` with the disposable workdir and matching project ID. Delete only the owned temp directory. Preserve the original failure exit code if cleanup also fails, and print the owned project ID/path for recovery.
8. `--keep` retains the owned stack/workdir for the next plan's manual investigation and prints a descriptor containing its path, project ID, port assignments and cleanup command. No credentials appear in that descriptor. Start/status output can contain keys; capture it and print only the nonsecret phase/status fields. Do not dump process environments or raw connection credentials into notes/CI logs.

Export the small workspace-preparation/cleanup functions from this module without starting a stack when imported. Later verification can reuse those functions; keep the interface local to these scripts.

**Verify:** `node --test scripts/verify-database.test.mjs` passes. Cover config transformation preserving SQL inputs and seed order, unique service ports, ownership/path guards, absence of copied link/env state, and zero-test rejection. Use temporary fixtures; no Docker needed for these tests.

### 3. Prove replay and failure isolation on the real local path

Run `pnpm db:verify --keep`. Record the exact commands, migration/file/SQL assertion counts, CLI version, and outcome. The expected migration versions equal all discovered filenames and every discovered test runs. Existing developer containers and migration history remain unchanged.

Use the retained scratch workdir to exercise generator behavior with `--output` pointing at a scratch file: full generation succeeds, immediate `--check` succeeds, and adding a sentinel comment to that scratch artifact makes `--check` fail without changing it. Clean up using the printed owned-project command.

Run `pnpm db:verify` a second time with default cleanup. Confirm its unique container set disappears on completion. Exercise a failure with a temporary test fixture in a disposable copied workspace, not by editing committed SQL tests, and confirm nonzero exit plus owned-resource cleanup. Do not suppress a historical migration, seed, SQL lint or pgTAP failure to make this gate green.

**Verify:** both legitimate runs exit 0; injected failures exit nonzero; before/after `docker ps` shows the existing `chooselife` stack was neither stopped nor replaced. `git diff --exit-code -- supabase/migrations supabase/tests supabase/seed.sql supabase/seeds packages/database/database-generated.types.ts supabase/config.toml` exits 0 relative to the executor's starting state.

### 4. Add root verification CI and document it

Create `.github/workflows/database.yml` for pull requests and pushes to `main` and `develop`. Scope path triggers to SQL/config/seeds/tests, database scripts, database package/lockfile, and this workflow; Plan 003 will extend paths for type consumers. Include `workflow_dispatch`, read-only contents permission, a timeout and concurrency cancellation.

Use root setup conventions: checkout, Node from `.nvmrc`, pnpm 11.10.0, frozen install, then helper tests and `pnpm db:verify`. The CLI comes solely from the exact dependency. No Supabase cloud token, DB password, OAuth client secret, linking, `db push` or function deployment is needed. Do not move or activate any nested deployment workflow. Explain the known non-gating type debt and Plan 003's required promotion in the notes and README.

Update the Supabase README's setup section to use the repository CLI and document isolated verification, `--keep`, cleanup, and safe generation/check modes. Preserve billing and release behavior; the retired renewal section is corrected by Plan 004.

**Verify:** run the workflow's exact local commands with `pnpm install --frozen-lockfile`, `node --test scripts/verify-database.test.mjs`, and `pnpm db:verify`. Inspect `.github/workflows/database.yml`: its only database target is the disposable verifier and it references no remote secrets. If available, run `actionlint .github/workflows/database.yml`; record availability rather than installing an unrelated tool solely for this check.

## Done criteria

- [ ] Repository CLI is exactly 2.121.0; frozen install and helper tests pass.
- [ ] Two independent disposable replays pass migrations, seeds, lint and all SQL tests, with counts recorded.
- [ ] Real generator success/check/drift/failure cases pass, preserving outputs on failure.
- [ ] Cleanup affects only owned resources, including failure paths.
- [ ] Root verification workflow requires no cloud credentials or hosted writes.
- [ ] Tracked types, SQL inputs and root Supabase config are unchanged.
- [ ] Notes contain `## Deviations` and `## How the run ended`, commands/results and any unavailable hosted CI result. Mark DONE for verified local capability; do not claim the hosted workflow ran unless observed.

## STOP conditions and recovery

Stop if CLI 2.121.0 cannot be installed with the pinned project runtime, required flags differ, the existing config is rejected, migration/seed replay fails, or any SQL test/lint gate fails after two focused attempts. Report the failing command and redacted diagnostic. Do not rewrite applied migrations, drop the existing local stack, disable authorization tests or add an unexplained failure allowlist.

A port collision or Docker failure may be retried once using a new owned workspace. An ownership validation failure must stop before reset/cleanup. A failure revealing already-broken historical SQL may leave this plan BLOCKED with that exact prerequisite identified. Cleanup uses the retained run's own workdir and project ID only.

## Maintenance and references

Future database changes must keep replay green. Plan 003 will make type parity mandatory; Plan 004 will add desired-schema parity. Keep dependency upgrades separate from engine enablement so failures are attributable.

- [Supabase CLI 2.121.0 release](https://github.com/supabase/cli/releases/tag/v2.121.0)
- [Pinned CLI lint flags](https://github.com/supabase/cli/blob/v2.121.0/apps/cli/src/commands/db/lint/lint.command.ts)
- [GitHub workflow location](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax#about-yaml-syntax-for-workflows)
- [Supabase database testing](https://supabase.com/docs/guides/local-development/testing/overview)
