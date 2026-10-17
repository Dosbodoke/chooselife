# Plan 002 execution notes

Worktree `/Users/juangsandrade/.t3/worktrees/chooselife/t3-f4bb91a0`, branch `t3/supabase-schema-workflow`. Each numbered step gets a separate review before the next one starts.

| Commit | Meaning |
| --- | --- |
| `427007b` | Parent HEAD the worktree started from |
| `775f09f` | Docs-only bootstrap with plans 002–004, the research report and the updated index, copied from the parent checkout |
| `775f09f` | Implementation base for Step 1 |
| `225af71` | Step 1 source changes |
| `fce9eee` | Step 1 notes. Implementation base for Step 1 revision 1 |
| `0d694f1` | Step 1 revision 1: output-path guards and filesystem error exit codes. Implementation base for Step 1 revision 2 |
| `fd8b6cb` | Step 1 revision 2: unsearchable output directory exits 2. Accepted by the third Sol review. Implementation base for Step 2 |
| `2c2ace6` | Step 2: disposable verification workspace, `db:verify` and helper tests |
| `8467699` | Step 2 revision 1: a failed `start` prints only stderr. Accepted by review |
| `c09a317` | Advisor docs only. Implementation base for Step 3 |
| Commit that adds this row | Step 3: real replay and failure-isolation evidence, notes only |

Commands ran under Node 24.18.0 from nvm, matching `.nvmrc`. The default `node` on PATH is 25.2.1, so a fresh shell needs `export PATH="$HOME/.nvm/versions/node/v24.18.0/bin:$PATH"` first. pnpm is 11.10.0.

## Step 1: pin the CLI and expose safe type generation

Status: accepted by the third Sol review.

Changes:

- `packages/database/package.json` pins `supabase` to exactly `2.121.0` and its `gen-types` script now runs `bash ../../supabase-gen-types.sh`.
- `package.json` adds `db:types` and `db:types:check`. `deploy:functions` is unchanged.
- `pnpm-lock.yaml` swaps `supabase@2.83.0` and its old download/tar closure for `supabase@2.121.0`. The new package ships per-platform `@supabase/cli-*` optional binaries plus `eciesjs` and `jose`. No other importer changed.
- `supabase-gen-types.sh` was rewritten to the plan's interface:

  ```text
  bash supabase-gen-types.sh [--check] [--workdir <Supabase project root>] [--output <artifact path>]
  ```

  It locates the repository root from its own path and runs `<root>/node_modules/.bin/supabase --workdir <abs workdir> --agent no gen types typescript --local --schema storage,public,functions`. It rejects `--linked`, unknown options and missing option values before calling the CLI, and requires `<workdir>/supabase/config.toml`. Write mode generates into a `mktemp` file next to the artifact, requires nonempty output with `export type Database = `, then does `chmod 644` and `mv`. Check mode generates into a system temp file, compares with `cmp` and never writes. Exit codes are 0 for success or no drift, 1 for drift, 2 for usage or generation errors. Revision 1 below routes filesystem errors to 2. All diagnostics go to stderr. An EXIT trap removes the temp file, and INT/TERM traps exit so the EXIT trap runs.

### Verification

| Command | Result |
| --- | --- |
| `pnpm install` | exit 0. Lockfile diff limited to the CLI closure described above |
| `pnpm install --frozen-lockfile` | exit 0, "Already up to date" |
| `pnpm exec supabase --workdir . --version` | `2.121.0` |
| `pnpm exec supabase --workdir . gen types --help` | Lists `--local`, `--linked`, `--db-url`, `--project-id`, `--lang`, `--schema`. Global `--workdir` is "used exactly as given, with no ancestor directory search". Global `--agent auto/yes/no` exists, so the helper pins `--agent no` |
| `bash -n supabase-gen-types.sh` | exit 0 |

Required failure gate. The scratch project lived under `mktemp -d "$TMPDIR/chooselife-gen-types-check.XXXXXX"`. Its `supabase/config.toml` was deliberately broken TOML with `project_id = "chooselife-gen-types-invalid"`. The sentinel output was a scratch `out/types.ts`, never the tracked artifact.

```bash
bash supabase-gen-types.sh --workdir "$S/proj" --output "$S/out/types.ts"
bash supabase-gen-types.sh --check --workdir "$S/proj" --output "$S/out/types.ts"
```

Both exited 2 with empty stdout. The CLI reported `failed to load config: Invalid TOML document`. The sentinel's sha256 was `b9609b7dff56719d934d86dc9bb826d724b94abc4cbd5801b2229d72b67d873c` before and after, and no temp file was left in `out/`.

Argument guards, same sentinel, all exit 2 before the CLI ran: `--linked`, `--bogus`, `--workdir --output <path>` (missing value), bare `--output`, and `--workdir <nonexistent dir>`. `pnpm --filter @chooselife/database gen-types --linked` and `pnpm db:types:check --bogus` also exit 2, which shows both script entry points reach the helper from their own directories.

Extra logic check without Docker. I copied the helper into a scratch root with a fake `node_modules/.bin/supabase`, so these runs exercise only the script:

| Case | Result |
| --- | --- |
| `--check` with no artifact | exit 1, nothing written |
| write | exit 0, artifact mode 644, no leftover temp |
| `--check` right after write | exit 0 |
| `--check` after appending a sentinel comment | exit 1, checksum unchanged |
| empty CLI output, write | exit 2, checksum unchanged |
| output without `export type Database`, write and `--check` | exit 2, checksum unchanged |
| SIGTERM while the fake CLI was mid-write | exit 143, checksum unchanged, temp file removed |

The tracked `packages/database/database-generated.types.ts`, `packages/database/index.ts`, `supabase/`, `next/` and `expo/` are unchanged (`git diff --exit-code` exit 0). No container, local database or cloud project was touched. The only CLI calls were `--version`, `--help` and the failing config load.

Not covered yet. Real generation against a running local database belongs to Step 3, which runs it against the disposable verifier stack.

### Revision 1: output-path and filesystem errors

The first Sol review returned fix-first with two findings:

1. An existing directory as `--output` made `mv` move the temp file into that directory and then report success.
2. Filesystem errors exited 1, which callers read as drift. A regular file in the output's parent path exited 1 from `mkdir -p` under `set -e`, and an unreadable artifact in `--check` was reported as drift.

Changes, all in `supabase-gen-types.sh`:

- Before generation, an `--output` that exists but is not a regular file exits 2. `-e`/`-f` follow symlinks, so a symlink to a directory is rejected too. This runs in both modes.
- Before generation, the helper walks up from the output's parent to the nearest existing path. If that path is not a directory, it exits 2. This catches a regular file anywhere in the parent chain in both modes, so `--check` no longer reports that case as a missing artifact.
- In write mode, `mkdir -p`, `mktemp`, `chmod` and `mv` failures each call `fail` (exit 2). `mktemp` in check mode does the same. The `mv` message says the artifact was not modified, and no success line is printed.
- `--check` records `cmp -s` status. 0 is up to date, 1 is drift, above 1 exits 2 with "Could not compare". A missing artifact still counts as drift (exit 1) without running `cmp`.
- The header comment now lists exit codes as 0 success or no drift, 1 drift or missing artifact, 2 usage, generation or filesystem error.

Verification ran in the worktree under Node 24.18.0 and pnpm 11.10.0. Base `fce9eee`.

| Command | Result |
| --- | --- |
| `bash -n supabase-gen-types.sh` | exit 0 |
| `pnpm exec supabase --workdir . --version` | `2.121.0` |

Real CLI failure gate, repeated. Scratch `S=$(mktemp -d "$TMPDIR/chooselife-gen-types-check.XXXXXX")`, broken TOML config with `project_id = "chooselife-gen-types-invalid"`, sentinel `$S/out/types.ts`:

```bash
bash supabase-gen-types.sh --workdir "$S/proj" --output "$S/out/types.ts"
bash supabase-gen-types.sh --check --workdir "$S/proj" --output "$S/out/types.ts"
```

Both exited 2 with empty stdout. The CLI reported `failed to load config: Invalid TOML document: incomplete key-value`. The sentinel sha256 was `754defb5ea581a63fd610981ad8b13eba7a69f4a7ffbbde7ab9cbbb10b8665fd` before and after. `out/` held only `types.ts`, and the count of `$TMPDIR/tmp.*` files was 1 before and after.

Fake-CLI harness. I copied the revised helper into `$(mktemp -d "$TMPDIR/chooselife-gen-types-r1.XXXXXX")/root` with a fake `node_modules/.bin/supabase`. A `FAKE_MODE` variable selects valid, empty, malformed or failing output. These runs exercise only the script, without Docker or a database. Every case matched its expected exit code with empty stdout:

| Case | Exit | Other evidence |
| --- | --- | --- |
| `--check`, no artifact | 1 | No artifact created |
| write | 0 | Mode 644, no temp file left |
| `--check` right after write | 0 | |
| `--check` after appending a sentinel comment | 1 | Checksum unchanged |
| write over the drifted artifact | 0 | New content present |
| write, `--output` is an existing directory | 2 | Directory still empty, no temp files under the scratch root |
| `--check`, `--output` is an existing directory | 2 | |
| write, `--output` is a symlink to a directory | 2 | Target directory empty, link intact |
| `--check`, `--output` is a symlink to a directory | 2 | |
| write, parent is a regular file (`plainfile/types.ts`) | 2 | "Output path component … is not a directory", file checksum unchanged |
| write, ancestor is a regular file (`plainfile/sub/types.ts`) | 2 | Same |
| `--check`, parent is a regular file | 2 | Same |
| `--check`, artifact mode 000 | 2 | "Could not compare", checksum unchanged after restoring mode |
| write into a read-only (555) directory | 2 | `mktemp` failure, artifact checksum unchanged, no temp |
| write to a missing subdirectory of a read-only directory | 2 | `mkdir` failure, subdirectory not created |
| write onto an artifact made immutable with `chflags uchg` | 2 | `mv` failure, "it was not modified", no "updated" line, checksum unchanged, no temp |
| write and `--check`, empty generation | 2 each | Checksum unchanged |
| write and `--check`, output without `export type Database` | 2 each | Checksum unchanged |
| write and `--check`, CLI exits 1 | 2 each | Checksum unchanged, no temp |
| SIGTERM while the fake CLI was mid-write | 143 | Checksum unchanged, temp removed |

Both scratch roots were deleted afterwards. `git diff --exit-code -- packages/database supabase next expo package.json pnpm-lock.yaml` exited 0. No container, local database or cloud project was touched. Real generation against a running database is still untested and stays with Step 3.

### Revision 2: unsearchable output directory

The second Sol review confirmed revision 1 but kept one finding. At `supabase-gen-types.sh:92`, an artifact whose parent directory lacks search permission makes `[ -e "$OUTPUT" ]` false, so `--check` reported an existing but inaccessible artifact as missing and exited 1. A scratch parent with mode 000 reproduced it. The review asked for exit 2 before the missing-artifact classification, using a small guard in the existing ancestor check. It accepted the concurrent destination-replacement race as residual risk for a local helper, so no locking was added.

Change: after the nearest existing ancestor of the output passes `-d`, it must also pass `-x`. Otherwise the helper exits 2 with "Output directory … is not searchable". This runs in both modes before generation. If a deeper ancestor is unsearchable, the walk stops at that ancestor because nothing below it can be stat'ed. If the nearest existing ancestor can be stat'ed, every directory above it is already searchable. A missing artifact under a searchable directory is still drift (exit 1).

Verification ran in the worktree under Node 24.18.0. Base `0d694f1`.

| Command | Result |
| --- | --- |
| `bash -n supabase-gen-types.sh` | exit 0 |
| `pnpm exec supabase --workdir . --version` | `2.121.0` |

Fake-CLI harness in `$(mktemp -d "$TMPDIR/chooselife-gen-types-r2.XXXXXX")/root`, built the same way as revision 1. Every case matched its expected exit code with empty stdout:

| Case | Exit | Other evidence |
| --- | --- | --- |
| `--check`, existing artifact, parent mode 000 | 2 | "Output directory …/locked is not searchable", checksum unchanged after restoring mode |
| write, existing artifact, parent mode 000 | 2 | Same |
| `--check`, `locked2/sub/types.ts` with `locked2` mode 000 | 2 | Names `locked2`, checksum unchanged |
| write, same nested path | 2 | Same, no temp file in `locked2/sub` |
| `--check`, `locked2/a/b/types.ts` with `locked2` mode 000 | 2 | Names `locked2` |
| `--check`, searchable directory, missing artifact | 1 | |
| `--check`, missing subdirectories under a searchable directory | 1 | |
| write | 0 | |
| `--check` right after write | 0 | |
| `--check` after appending a drift comment | 1 | Checksum unchanged |
| write and `--check`, `--output` is an existing directory | 2 each | Directory still empty |
| write and `--check`, `--output` is a symlink to a directory | 2 each | |
| write and `--check`, parent is a regular file | 2 each | File checksum unchanged |

No `.types.ts.*` temp file was left anywhere under the scratch root. Permissions were restored to 755 before the checksums were taken, then the scratch directory was deleted.

Real CLI failure gate, repeated. Scratch `$(mktemp -d "$TMPDIR/chooselife-gen-types-check.XXXXXX")`, broken TOML with `project_id = "chooselife-gen-types-invalid"`, sentinel `out/types.ts`. Write mode and `--check` each exited 2 with empty stdout and `failed to load config: Invalid TOML document: incomplete key-value: cannot find end of key`. The sentinel sha256 was `27d5a937427dc377117190077855d3110d22c9589406a12b1bb4b2a26071fa63` before and after. `out/` held only `types.ts`, and the `$TMPDIR/tmp.*` count was 1 before and after. The scratch directory was deleted.

No container, local database or cloud project was touched.

## Step 2: disposable verification workspace

Status: implemented and verified with helper tests and CLI help only. Waiting for review. No container was started, stopped or reset, so a real replay has not run yet. That is Step 3.

Changes:

- `scripts/verify-database.mjs` (new). Node built-ins only, no new dependency.
- `scripts/verify-database.test.mjs` (new). `node:test`, no Docker.
- `package.json` adds `"db:verify": "node scripts/verify-database.mjs"`. Other scripts are unchanged.

### Pinned CLI behavior the verifier relies on

All read from `node_modules/.bin/supabase --workdir . <command> --help` on 2.121.0, plus the bundled CLI source where help is silent:

| Need | 2.121.0 behavior |
| --- | --- |
| Lifecycle | `start [--exclude] [--ignore-health-check]`; `stop [--project-id] [--no-backup] [--all]`. `start` has no `--local` flag |
| Replay | `db reset --local` with `--no-seed`, `--sql-paths`, `--version`, `--last`. Global `--yes` answers prompts |
| Lint | `db lint --local --schema --level warning/error --fail-on none/warning/error` |
| Tests | `test db [--local] [<path...>]`. The bundled source resolves relative paths against the process cwd, not `--workdir`, and defaults to `<workdir>/supabase/tests`. It runs `pg_prove --ext .pg --ext .sql -r` and streams raw TAP to stdout. The CLI itself reads the `Files=N,` and `Result:` lines |
| Applied versions | `db query --local [<sql>]`. With `--agent no` and global `--output json`, stdout is a JSON array of row objects and "Connecting to local database..." goes to stderr. Agent mode would wrap rows in an untrusted-data envelope |
| Output and agent detection | Global `--output-format text/json/stream-json` and `--agent auto/yes/no` |
| Binary selection | `node_modules/supabase/dist/supabase.js` picks the platform binary unless `SUPABASE_CLI_BINARY_OVERRIDE` is set |
| Config validation | No offline validator. `config` has only `diff`, `pull` and `push`, which are remote |

### Behavior

`pnpm db:verify [--keep] [--check-types]`. Exit 0 pass, 1 verification or cleanup failure, 2 usage error, 128 + signal number when interrupted. Arguments are parsed before anything else, so unknown options, `--linked`, `--workdir` and `--db-url` exit 2 with no temp directory or CLI call.

1. Prepare. `fs.mkdtemp(<realpath os.tmpdir()>/chooselife-verify-)` creates the root. The project ID is `chooselife-verify-<12 hex>` from `crypto.randomBytes`. From `supabase/` it copies `migrations/` and `tests/` (required), and `seeds/`, `schemas/`, `verification/` and `seed.sql` when present. Copies are regular files only. Dotfiles are skipped, which covers `.env*`, `.temp`, `.branches` and `.DS_Store`. A symlink or special file anywhere in an input, or an input that is itself a link, fails the run instead of being dropped. `functions/`, `scripts/`, `.temp/project-ref` and everything else stay behind.
2. Config. A line-based rewrite of `config.toml` sets top-level `project_id`. Every `*port` key in `[api]`, `[db]`, `[db.pooler]`, `[studio]`, `[inbucket]`, `[analytics]` and `[edge_runtime]` gets a fresh port, and the expected keys are added when the source relies on defaults, including `db.shadow_port`. Ports come from listening on `127.0.0.1:0` with every socket held until all are allocated, then a uniqueness check. Studio, analytics and Edge runtime get `enabled = false`. `[functions.*]` sections are dropped because Edge runtime is off. Every other line is kept byte-for-byte, including `[db] major_version`, `[db.seed]` `enabled` and `sql_paths` order, `[auth]`, Storage, Realtime, API and the disabled external providers. Ports outside those sections, such as `[auth.email.smtp]`, are left alone. Every literal `sql_paths` entry must exist in the copy and resolve inside `supabase/`.
3. Discovery. Expected versions come from top-level `migrations/*.sql` matching `^(\d+)_.*\.sql$`. A `.sql` file that does not match fails, because the CLI would skip it. Expected test files are `.sql` and `.pg` files under `tests/`, matching `pg_prove`. Zero migrations or zero test files fail before Docker is touched.
4. Ownership. `assertOwnedWorkspace` runs at the end of preparation, before `start`, before `db reset` and before every cleanup. The project ID must match the generated pattern. The root must be absolute, a direct child of `realpath(os.tmpdir())`, named `chooselife-verify-XXXXXX`, a real directory rather than a link, owned by the current uid, and its copied `config.toml` must carry that project ID.
5. Commands. All use `process.execPath <repo>/node_modules/supabase/dist/supabase.js --workdir <owned root> --agent no --output-format text …`, with `stdin` ignored and output captured:
   - `start`
   - `db reset --local --yes`
   - `db query --local --output json "select version from supabase_migrations.schema_migrations order by version"`. Read-only. The sorted versions must equal the migration filenames exactly
   - `db lint --local --schema public --level error --fail-on error`
   - `test db --local <root>/supabase/tests`, run from cwd `<root>`. Requires `Result: PASS`, `Files=` equal to the discovered count and `Tests=` above zero. A missing or unparseable summary fails even when the CLI exits 0
   - cleanup: `stop --project-id <id> --no-backup`

   No call uses `--all`, `--linked`, `--db-url` or `--project-ref`.
6. Environment. Child processes get an allowlist: `PATH`, `HOME`, `USER`, `LOGNAME`, `SHELL`, `LANG`, `LC_*`, `TZ`, `CI`, temp dirs, `XDG_*` dirs, `DOCKER_HOST`, `DOCKER_CONTEXT`, `DOCKER_CONFIG`, `DOCKER_CERT_PATH`, `DOCKER_TLS_VERIFY`, `DOCKER_API_VERSION`, CA bundle and proxy variables, and Windows system paths. `NO_COLOR=1` is added. Everything else is dropped, including all `SUPABASE_*` tokens and passwords, `SUPABASE_CLI_BINARY_OVERRIDE`, `OPENAI_API_KEY`, `S3_*`, cloud keys and `DOCKER_PASSWORD`.
7. Output. Successful runs print only phase names and counts. `start` stdout is never printed, on success or failure. A failed `start` prints only the last 40 lines of its stderr. Other failed commands print the last 40 lines of stderr plus stdout. Both pass through `redact`, which masks JWTs, `sb_secret_`/`sb_publishable_` keys, URL passwords and `…key|secret|password|token: value` lines.
8. Cleanup. Without `--keep`, cleanup always runs, including after failures and SIGINT/SIGTERM. It checks ownership, stops the owned project if `start` was attempted, then removes only the owned root. A failed `stop` leaves the root in place, keeps a nonzero primary exit code (or sets 1 after a pass), and prints `Recover with: <command>`. The first signal kills the running CLI call unless cleanup is already running. Repeated signals are ignored so cleanup can finish.
9. `--keep` skips cleanup, including after a failure, and prints the descriptor below.
10. `--check-types` runs `bash supabase-gen-types.sh --check --workdir <owned root>` after the tests, against the tracked artifact. Exit 1 fails the run with "This drift is known until Plan 003". Default runs never call it.

### Exported interface for later steps and plans

Importing the module has no side effects. The CLI runs only under `import.meta.main`, available from Node 24.2.

```js
prepareWorkspace({ repoRoot? }) -> Promise<Workspace>   // copy, rewrite config, allocate ports, discover counts; removes itself on failure
assertOwnedWorkspace(workspace) -> Promise<void>         // throws VerifyError("Refusing …")
cleanupWorkspace(workspace, { stopStack = true }) -> Promise<void>  // ownership check, stop --project-id … --no-backup, rm owned root
describeWorkspace(workspace) -> Descriptor
transformConfig(source, projectId, takePort) -> { text, ports }
allocatePorts(count) -> Promise<number[]>
childEnv(env = process.env) -> object
parsePgProveSummary(output) -> { files, assertions, result }
redact(text) -> string
parseArgs(argv) -> { keep, checkTypes, help }
main(argv) -> Promise<exitCode>

Workspace = { root, projectId, ports, testsDir, testFiles, migrationVersions }
```

The retained descriptor holds no credentials:

```json
{
  "path": "<realpath tmpdir>/chooselife-verify-XXXXXX",
  "projectId": "chooselife-verify-<12 hex>",
  "ports": { "api.port": 0, "db.port": 0, "db.shadow_port": 0, "db.pooler.port": 0, "studio.port": 0, "inbucket.port": 0, "analytics.port": 0, "edge_runtime.inspector_port": 0 },
  "cleanup": "'<repo>/node_modules/.bin/supabase' --workdir '<path>' stop --project-id <id> --no-backup && rm -rf '<path>'"
}
```

### Verification

Base `fd8b6cb`. Node 24.18.0, pnpm 11.10.0.

| Command | Result |
| --- | --- |
| `node --test scripts/verify-database.test.mjs` | 38 tests, 38 pass, about 3 s. Four repeated runs were all green. Also passes under the default Node 25.2.1 |
| `prettier --check scripts/verify-database.mjs scripts/verify-database.test.mjs package.json` (repo Prettier 3.8.1) | clean |
| `pnpm db:verify --help` | exit 0. Usage names the Docker-compatible runtime requirement |
| `TMPDIR=<scratch> pnpm db:verify --bogus` and `--linked` | exit 2. No `chooselife-verify-*` directory. The only scratch entry was Node's own `node-compile-cache` from pnpm, and a direct `node scripts/verify-database.mjs --bogus` left the scratch dir empty |
| `pnpm -w db:verify --nope` from `packages/database` | exit 2, so the root script resolves from a package directory |
| `git diff --exit-code -- supabase packages pnpm-lock.yaml supabase-gen-types.sh next expo .github plans/README.md` | exit 0 |

What the tests cover. They use temporary fixture repositories and never touch Docker. Each fixture contains a copy of the real `supabase/config.toml`, two migrations (one named `*.sql.sql` like the real tree), nested `.sql`/`.pg` tests, both seed files, decoy `.env`, `.temp/project-ref`, `.branches`, `functions/`, `scripts/` and a symlink. End-to-end cases copy the real verifier into the fixture and run it as a child process with `TMPDIR` pointed at a per-test directory. A fake `node_modules/supabase/dist/supabase.js` records each call's argv, cwd and environment and answers from a behavior file. The child environment is seeded with fake `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD`, `SUPABASE_PROJECT_ID`, `SUPABASE_CLI_BINARY_OVERRIDE`, `OPENAI_API_KEY` and `AWS_SECRET_ACCESS_KEY`.

- Import in a fresh process prints nothing and creates nothing.
- Copy and config: exact copied tree with no links or env/state files. Project ID, seed order, `db.seed.enabled`, `major_version`, auth values and the disabled Apple provider all match the source. API, Realtime, Storage, Auth and Inbucket stay enabled. Studio, analytics and Edge runtime are disabled. No `[functions`. Eight unique ports, none equal to the source ports.
- `transformConfig` adds missing service ports and disabled flags, and leaves `[auth.email.smtp] port` alone.
- Preparation failures leave nothing in the temp dir: a linked test, a linked `seeds/`, zero tests, zero migrations, a misnamed migration, a missing seed (single-line and multi-line `sql_paths`), and a missing `tests/`.
- Ownership: wrong or invalid project ID, the fixture repo, a stranger temp dir, a symlink decoy with a valid name, a subdirectory and a relative path are all refused by both `assertOwnedWorkspace` and `cleanupWorkspace`, and nothing is deleted.
- `childEnv` keeps runtime and Docker settings and drops every credential listed above.
- `parsePgProveSummary` rejects empty or partial output. `redact` masks keys, the JWT secret and URL passwords, and keeps the diagnostic text.
- Invalid arguments exit 2 with zero CLI calls and no temp dir. `--help` exits 0 with zero calls.
- A passing run calls exactly `start`, `db reset`, `db query`, `db lint`, `test db`, `stop` with the flags in section 5, every call pinned to the owned root. `test db` gets an absolute test path and cwd = root. `stop` gets the printed project ID. No credentials reach any child. No fake key appears in the output. The temp dir ends empty.
- Each of these exits 1, still ends with `stop`, leaves the temp dir empty and prints no secret: start failure (with secrets in its output), reset failure, mismatched versions, unparseable versions, lint failure, failed test, `Tests=0`, `Files` below the discovered count, unparseable test output.
- A failed `stop`, after a failed test or after a pass, exits 1, keeps the workspace and prints the exact recovery command.
- `--keep` exits 0 with no `stop` call. The descriptor has exactly `path`, `projectId`, `ports` and `cleanup`, passes the ownership check and contains no secret.
- `--check-types` runs the generator with exactly `--check --workdir <owned root>`. Generator exit 0 passes, exit 1 fails with the Plan 003 message. Default runs never call the generator.
- SIGTERM during `start` exits 143 and calls only `start` and `stop`. SIGTERM during cleanup does not kill `stop`, so the owned root is still removed.

Mutation check. Each change below was applied to a scratch copy of the script, then the original was restored. Every one made at least one test fail: dropping `--local` from reset, passing the whole environment, accepting zero assertions, keeping `[functions.*]`, copying dotfiles, never stopping the stack, losing the primary exit code on cleanup failure, killing `stop` on a signal during cleanup, and single-line-only `sql_paths` parsing.

Non-mutating probe against the real tree. `prepareWorkspace()` reported 41 migrations, 12 test files and 8 unique ports. The copy held only `config.toml`, `migrations`, `seed.sql`, `seeds` and `tests`. Then `supabase --workdir <copy> --agent no --output-format text gen types typescript --local` ran with the filtered environment and exited 1 with `supabase start is not running.`: the pinned CLI loaded the rewritten config and found nothing running for the new project ID. `cleanupWorkspace(ws, { stopStack: false })` removed the copy. No container was started, stopped or reset.

Not covered yet, all for Step 3: whether 2.121.0 starts a stack from the rewritten config, whether `--yes` is needed or accepted by `db reset`, the real `db query` JSON and pg_prove summary, mount behavior of temp paths under Docker or OrbStack, unresolved `env()` references in the copied config with the filtered environment, and port collisions.

### Revision 1: start failure output

Sol round 1 found that a failed `start` printed its stdout through `redact`. The pinned CLI's `status-pretty.ts` prints S3 Access Key and Secret Key as plain table values, and `redact` only matches `label: value` or `label=value`, so a JWT secret or key in a Unicode or ASCII table cell survived.

Fix, local to the `start` step in `main`: it calls `runCli` directly and, on a nonzero exit, throws with stderr only. `runCliStep`, `redact` and every other step are unchanged.

New test `a start failure prints its stderr but none of its credential stdout`. The fake `start` exits 1 with stdout holding synthetic sentinels in Unicode box tables (keys, JWT secret, S3 Access Key and Secret Key), an ASCII table and a bare line, and stderr holding a port error plus a `JWT secret:` line. The test first asserts that `redact(stdout)` alone still leaks a sentinel, so it exercises the gap. It then requires exit 1, the `supabase start (is Docker running?) failed (exit 1)` message, the port error from stderr, no sentinel anywhere in stdout or stderr, exactly `start` then `stop`, an empty temp dir, and the fixture's `config.toml`, migration and `.temp/project-ref` still present.

Base `2c2ace6`. Node 24.18.0 from `/Users/juangsandrade/.nvm/versions/node/v24.18.0/bin`.

| Command | Result |
| --- | --- |
| `node --test scripts/verify-database.test.mjs` | 39 tests, 39 pass, about 3.7 s |
| Mutation: start error output set back to `result.stderr + result.stdout` in a scratch edit, then restored | 38 pass, 1 fail: the new test. Restored file matches the fix |
| `node_modules/.bin/prettier --check scripts/verify-database.mjs scripts/verify-database.test.mjs` (3.8.1) | clean |
| `git diff --check fd8b6cb..HEAD` after commit | clean. Also removed the trailing whitespace on the blank line after the `cleanup:` command in section 5 |
| `git diff --exit-code 2c2ace6 -- supabase packages pnpm-lock.yaml supabase-gen-types.sh package.json next expo .github plans/README.md` | exit 0 |

No container, Docker command or real CLI call ran for this revision.

## Step 3: real replay and failure isolation

Status: done locally, waiting for review. No tracked source changed. This commit only adds these notes.

Base `c09a317`. Node 24.18.0 from nvm, pnpm 11.10.0, `pnpm exec supabase --workdir . --version` = `2.121.0`. Docker server and client 29.8.2 on the `orbstack` context. Every command ran from the worktree unless noted. Private evidence files lived in a mode-700 scratch directory that is not part of the repository.

Before any mutation I checked the pinned CLI help with `node_modules/.bin/supabase --agent no <group> <command> --help`. `db reset` has `--local`, `--no-seed`, `--sql-paths`, `--version` and `--last`. `db lint` has `--local`, `--schema`, `--level warning|error` and `--fail-on none|warning|error`. `test db` takes `--local [<path...>]`, and `db query` takes `--local [<sql>]`. `stop` has `--project-id`, `--no-backup` and `--all`. `start` has `--exclude` and `--ignore-health-check`. Global flags include `--workdir`, `--yes`, `--agent` and `--output-format`. This matches the Step 2 table.

### Preservation snapshot

Before the first run, read-only:

- `docker ps -a` (ID, name, status and image only): 12 containers, all `supabase_*_chooselife`, up 12 hours. Postgres image `15.8.1.044`.
- `docker inspect --format '{{.Name}} {{.Id}} {{.State.StartedAt}} {{.RestartCount}}'` for every container. No environment or config fields were read.
- Volume names: `supabase_db_chooselife`, `supabase_edge_runtime_chooselife`, `supabase_storage_chooselife` and one unrelated volume. Network names: `supabase_network_chooselife` plus the defaults and one unrelated network.
- `docker exec supabase_db_chooselife psql -U postgres -d postgres -tAX -c "select version || ' ' || coalesce(name,'') from supabase_migrations.schema_migrations order by version"`: 41 rows, last `20261015013845 webbing_catalog_snapshot`, sha256 `2b6d8c0397a6d7209a7a854787f87a64505532073e95aeb2841c5510dba6f027`.
- Tracked `packages/database/database-generated.types.ts` sha256 `40efe65c104497a7e6504a6e8373757f84d57180b6bab80c1f70a7ce39aabaa1`.

Derived input counts at `c09a317`: `ls supabase/migrations | wc -l` = 41, and `find supabase/tests -name '*.sql' -o -name '*.pg' | wc -l` = 12.

### Run 1: `pnpm db:verify --keep`

Exit 0, 02:26:32–02:27:52 UTC, including the first pull of newer service images. Stdout held only phase lines and the descriptor. Stderr held only pnpm's `$ node scripts/verify-database.mjs --keep` echo.

```text
Preparing disposable project: ok (chooselife-verify-78be7eb6c7b2, 41 migrations, 12 test files)
Starting disposable stack: ok
Replaying migrations and seeds: ok
Comparing applied migrations: ok (41 versions match 41 files)
Linting public schema: ok
Running pgTAP tests: ok (12 files, 371 assertions)
Verification passed.
```

Kept descriptor, with no credentials: path `/private/var/folders/4d/px4017t53z7dx66qvy4fcvx00000gn/T/chooselife-verify-aSvGma`, project `chooselife-verify-78be7eb6c7b2`, ports `api 51898`, `db 51899`, `db.shadow 51900`, `db.pooler 51901`, `studio 51902`, `inbucket 51903`, `edge_runtime.inspector 51904`, `analytics 51905`, and the cleanup command `'<worktree>/node_modules/.bin/supabase' --workdir '<path>' stop --project-id chooselife-verify-78be7eb6c7b2 --no-backup && rm -rf '<path>'`.

Owned resources while kept: seven containers, `supabase_{auth,db,inbucket,kong,realtime,rest,storage}_chooselife-verify-78be7eb6c7b2`, all healthy except `rest`, which has no health check. Images were postgres `15.19.0.004`, gotrue `v2.197.0`, realtime `v2.143.4`, storage-api `v1.82.1`, postgrest `v16.4`, mailpit `v1.31.3` and kong `2.8.1`. There were two volumes, `supabase_db_…` and `supabase_storage_…`, and one network, `supabase_network_…`. No Studio, analytics, Edge runtime, vector or pg-meta container started. The database major version stays 15, matching `[db] major_version`.

This run settles the open questions from Step 2. Under 2.121.0, `start` accepts the rewritten config. `db reset --local --yes` replays every migration and both seed files without hanging. The real `db query --output json` result and the `pg_prove` `Files=`/`Tests=`/`Result:` summary parse. OrbStack mounts the `/private/var/folders/…` temp root. The allowlisted environment is enough, and no `env()` reference failed. The allocated ports did not collide.

### Generator against the kept stack

Scratch output `<mktemp -d $TMPDIR/chooselife-s3-gen.XXXXXX>/out/types.ts`, never the tracked artifact. `K` is the kept workdir.

| Command | Exit | Evidence |
| --- | --- | --- |
| `bash supabase-gen-types.sh --workdir "$K" --output "$O"` | 0 | Empty stdout. Stderr `Connecting to 127.0.0.1 51899`, which is the owned DB port. 1609 lines, one `export type Database = `, mode 644, no temp file left, sha256 `6385a97a…16a5` |
| `bash supabase-gen-types.sh --check --workdir "$K" --output "$O"` | 0 | "Database types are up to date", sha256 unchanged |
| Append `// step3 drift sentinel`, then `--check` again | 1 | "Database types are out of date", sha256 `2c611437…81bb` before and after, sentinel still the last line |
| `pnpm db:types:check --workdir "$K"` against the tracked artifact | 1 | Expected known drift for Plan 003. Tracked sha256 unchanged |
| After cleanup: write mode and `--check` against a scratch copy of the kept `config.toml`, whose project is no longer running | 2 each | `supabase start is not running.`, "…was not modified", empty stdout, sentinel sha256 unchanged, no temp file |

The CLI also printed `Generated TypeScript is unformatted. Format it with: npx oxfmt <generated-file.ts>` on stderr. The tracked artifact has 3407 lines and the fresh output has 1609. Plan 003 has to choose the formatting before type parity can gate.

Cleanup used the printed command verbatim. It exited 0 and printed `{"project_id_filter":"chooselife-verify-78be7eb6c7b2","backup":false,"message":"Stopped supabase local development setup."}`. It printed JSON because that command does not pin `--agent no`, so agent auto-detection chose JSON. Afterwards there were zero `chooselife-verify` containers, volumes or networks, the kept directory was gone, and the generator scratch directory was deleted.

### Run 2: `pnpm db:verify` with default cleanup

Exit 0, 02:28:51–02:29:51 UTC. Project `chooselife-verify-ea7dd61db38c`, 41 migrations, 12 test files, 41 versions matched 41 files, lint ok, 12 files and 371 assertions, `Removed the disposable project.` A background poll of `docker ps -a` saw exactly the same seven service containers for this project ID. After exit there were zero `chooselife-verify` containers, volumes and networks, and no `chooselife-verify-*` directory in `$TMPDIR`.

### Run 3: injected failure in a disposable copy

The scratch repository was `<mktemp -d $TMPDIR/chooselife-s3-fail.XXXXXX>`. It held a byte-identical copy of `scripts/verify-database.mjs` (checked with `cmp`), `supabase-gen-types.sh`, a symlink to the worktree's `node_modules`, and copies of `supabase/config.toml`, `seed.sql`, `migrations/`, `seeds/` and `tests/`. It added one fixture, `supabase/tests/zz_injected_failure_test.sql`: `begin; select plan(2); select ok(true, …); select ok(false, 'injected failure: this assertion must fail'); select * from finish(); rollback;`. No committed SQL was edited, and the verifier gained no new API. Running the copy's `node scripts/verify-database.mjs` from the scratch root uses the real CLI and the real `main()` cleanup path.

Exit 1, 02:30:00–02:31:00 UTC. Project `chooselife-verify-906b7b1b754f`, with 41 migrations and 13 test files discovered. Replay, migration comparison and lint passed. Then the run printed `pgTAP failed (exit 1).`, the redacted pg_prove tail with all 12 real files `ok`, `# Failed test 2: "injected failure: this assertion must fail"`, `Files=13, Tests=373`, `Result: FAIL`, and `Removed the disposable project.` The same seven owned containers appeared, and afterwards there were zero `chooselife-verify` containers, volumes, networks or temp directories. No JWT, `sb_secret_`/`sb_publishable_` key or URL password pattern appeared in stdout or stderr. The scratch repository was deleted.

### Postconditions

| Check | Result |
| --- | --- |
| `docker ps -a` ID/name/status/image, hours normalized | identical to the snapshot |
| `docker inspect` name, ID, `StartedAt`, `RestartCount` for every container | identical, so the `chooselife` stack was neither stopped, restarted nor replaced |
| Volume and network names | identical |
| Developer `schema_migrations` dump | 41 rows, same sha256 `2b6d8c03…f027` |
| `git diff --exit-code -- supabase/migrations supabase/tests supabase/seed.sql supabase/seeds packages/database/database-generated.types.ts supabase/config.toml` | exit 0 |
| `git diff --exit-code c09a317 -- supabase packages pnpm-lock.yaml supabase-gen-types.sh package.json scripts next expo .github plans/README.md plans/supabase-implementation.orchestration.md` | exit 0 |
| `node --test scripts/verify-database.test.mjs` | 39 tests, 39 pass |

No hosted project, token or password was used. No command used `--all`, `--linked`, `--db-url` or `--project-ref`. Every start, reset, stop and generation targeted a `chooselife-verify-*` workdir created by `prepareWorkspace`. The one exception is the developer history read, which ran `select` through `docker exec` on the existing DB container. Raw `start` and `status` output was never printed, and no environment or connection string was inspected or recorded. No port or Docker retry was needed.

## Deviations

- `[functions.*]` sections are dropped from the disposable config. They point at `functions/`, which is not a verification input, and Edge runtime is disabled in the copy. The root config is unchanged.
- Links and special files inside copied inputs fail the run instead of being skipped. Skipping one would silently drop a migration, seed or test. Dotfiles are skipped.
- Literal `sql_paths` entries must exist in the copy and resolve inside `supabase/`. The config template allows `../` paths, but nothing here uses them, and they would fall outside the copied inputs.
- `--keep` also keeps the workspace after a failed run, since that is when investigation is needed.
- Explicit `--check-types` fails on known drift. Only the default run, which skips the check, stays green until Plan 003.
- `db reset` gets global `--yes` so a confirmation prompt cannot hang a non-interactive run. Step 3 confirms whether 2.121.0 prompts at all.
- Child environments use an allowlist rather than a denylist. A denylist could miss a credential, and an allowlist that misses a needed runtime variable fails visibly in Step 3.
- A signal received during cleanup does not change the exit code of a run that already passed.
- The helper passes `--agent no`, which the plan did not ask for. The pinned CLI auto-detects agent environments, and generated stdout should not depend on which shell or agent runs it.
- A missing artifact in `--check` mode counts as drift (exit 1), not as an error.
- Revision 1 rejects any existing non-regular `--output`, not just directories. FIFOs and device nodes would otherwise hang `cmp` or be replaced by `mv`, and the same one-line guard covers them.
- The branch kept its app-managed name `t3/supabase-schema-workflow`. Renaming could break the T3 thread binding.
- Step 3 injected the failing test by running a byte-identical copy of the verifier from a disposable repository copy with one extra fixture, rather than calling `prepareWorkspace` and driving the CLI by hand. This exercises the real `main()` failure and cleanup path without editing committed SQL or adding an injection API.
- Step 3 also ran a real generator failure against a stopped owned project. The plan only required success, equal-check and drift-check on the kept stack. It also ran `db:types:check` once against the kept stack to record the known tracked-type drift.
- Step 3 recorded developer migration history with a read-only `select` through `docker exec` on the existing DB container, instead of running a Supabase CLI command against the developer project.

## How the run ended

Step 1 and revisions 1 and 2 were accepted by the third Sol review. Step 2 and its revision 1 were accepted. Step 3 is done locally and waits for review. Two real disposable replays exited 0, each with 41/41 migrations, both seeds, a clean lint and 12 files with 371 assertions. Real generator success, equal-check, drift-check and failure cases behaved as specified. An injected pgTAP failure exited 1 and cleaned up only its owned resources. The developer `chooselife` stack, its migration history, tracked types, SQL inputs and the root config are unchanged. Step 4 (CI workflow and README) has not started, so the plan is not DONE.

Remaining risk. The destination check runs before generation. If another process turns the destination into a directory during generation, `mv` would still nest the file inside it. Portable `mv` has no no-target-directory flag on both macOS and Linux, and the artifact path is not shared with other writers. The second review accepted this as residual risk. Revision 2 fixed the unsearchable-parent case.

Step 2 remaining risk. The allocation sockets close before `start` binds the ports, so another process can take one in between. `start` then fails and cleanup removes only the owned project. The verifier does not retry automatically. The plan allows one manual retry with a new workspace. `redact` is pattern-based defense in depth and misses table-formatted values, so `start` stdout is never printed, and successful runs print no status output at all. Stderr and the stdout of later commands still rely on `redact`. Step 3 observed a real `test db` failure. Its output held only pg_prove TAP lines and CLI errors, with no key patterns. A failing `db reset` or `db lint` has still not been observed for real.

Step 3 observations for Step 4 and Plan 003. The printed cleanup command does not pass `--agent no`, so under agent detection `stop` prints a JSON status line. That is harmless and has no credentials. Pinned 2.121.0 generates unformatted TypeScript, 1609 lines against the tracked 3407, and suggests `oxfmt`. Plan 003 must settle formatting before type parity can gate. A cold run that pulls images took about 80 s. Warm runs took about 60 s.
