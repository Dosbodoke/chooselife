# Plan 002 execution notes

Worktree `/Users/juangsandrade/.t3/worktrees/chooselife/t3-f4bb91a0`, branch `t3/supabase-schema-workflow`. Each numbered step gets a separate review before the next one starts.

| Commit | Meaning |
| --- | --- |
| `427007b` | Parent HEAD the worktree started from |
| `775f09f` | Docs-only bootstrap with plans 002–004, the research report and the updated index, copied from the parent checkout |
| `775f09f` | Implementation base for Step 1 |
| `225af71` | Step 1 source changes |

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

  It locates the repository root from its own path and runs `<root>/node_modules/.bin/supabase --workdir <abs workdir> --agent no gen types typescript --local --schema storage,public,functions`. It rejects `--linked`, unknown options and missing option values before calling the CLI, and requires `<workdir>/supabase/config.toml`. Write mode generates into a `mktemp` file next to the artifact, requires nonempty output with `export type Database = `, then does `chmod 644` and `mv`. Check mode generates into a system temp file, compares with `cmp` and never writes. Exit codes are 0 for success or no drift, 1 for drift, 2 for usage or generation errors. All diagnostics go to stderr. An EXIT trap removes the temp file, and INT/TERM traps exit so the EXIT trap runs.

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

## Deviations

- `db:verify` is not registered yet. `scripts/verify-database.mjs` does not exist until Step 2, and a root script pointing at a missing file would fail with a module error. Step 2 adds the script and its entry together.
- The helper passes `--agent no`, which the plan did not ask for. The pinned CLI auto-detects agent environments, and generated stdout should not depend on which shell or agent runs it.
- A missing artifact in `--check` mode counts as drift (exit 1), not as an error.
- The branch kept its app-managed name `t3/supabase-schema-workflow`. Renaming could break the T3 thread binding.

## How the run ended

Step 1 is complete and verified locally. Steps 2–4 have not started.
