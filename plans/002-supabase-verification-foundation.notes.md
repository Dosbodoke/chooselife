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
| Commit that adds this row | Step 1 revision 2: unsearchable output directory exits 2 |

Commands ran under Node 24.18.0 from nvm, matching `.nvmrc`. The default `node` on PATH is 25.2.1, so a fresh shell needs `export PATH="$HOME/.nvm/versions/node/v24.18.0/bin:$PATH"` first. pnpm is 11.10.0.

## Step 1: pin the CLI and expose safe type generation

Status: implemented and locally verified. Waiting for review.

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

## Deviations

- `db:verify` is not registered yet. `scripts/verify-database.mjs` does not exist until Step 2, and a root script pointing at a missing file would fail with a module error. Step 2 adds the script and its entry together.
- The helper passes `--agent no`, which the plan did not ask for. The pinned CLI auto-detects agent environments, and generated stdout should not depend on which shell or agent runs it.
- A missing artifact in `--check` mode counts as drift (exit 1), not as an error.
- Revision 1 rejects any existing non-regular `--output`, not just directories. FIFOs and device nodes would otherwise hang `cmp` or be replaced by `mv`, and the same one-line guard covers them.
- The branch kept its app-managed name `t3/supabase-schema-workflow`. Renaming could break the T3 thread binding.

## How the run ended

Step 1 and revisions 1 and 2 are complete and verified locally. Revision 2 waits for a new review. Steps 2–4 have not started.

Remaining risk. The destination check runs before generation. If another process turns the destination into a directory during generation, `mv` would still nest the file inside it. Portable `mv` has no no-target-directory flag on both macOS and Linux, and the artifact path is not shared with other writers. The second review accepted this as residual risk. Revision 2 fixed the unsearchable-parent case.
