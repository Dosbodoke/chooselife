# Plan 005 execution notes

Final status: the local mirror is published and verified. The mobile picker code passes its automated checks, and the iOS tile layout has been visually verified after the user signed in. Other native cases and application release remain unverified. This file records the coding phase first, followed by the parent's live verification below. No GitHub workflow, recurring job, commit, push, or application deployment was performed.

Implemented October 17, 2026 on `feat/hosted-slackdata-webbings` (working tree, uncommitted), starting from `b793adf`. This was the local-first implementation only. I didn't upload anything to R2, write `latest.json`, create a GitHub workflow, commit, push or deploy. GPT Sol owns rclone operations and records them in [005-slackdata-rclone.notes.md](005-slackdata-rclone.notes.md).

## Files

- `scripts/slackdata/sync.py`: validator, deterministic release builder and publisher. Python standard library, git and rclone.
- `scripts/slackdata/test_sync.py`: 42 tests. 41 are synthetic, with a stub rclone and a fake CDN. 1 runs the real rclone against a closed loopback port and is skipped if rclone isn't installed.
- `scripts/slackdata/README.md`: runbook, opt-in launchd example, rollback and removal.
- `scripts/slackdata/denylist.txt`: empty removal denylist, comments only.
- `expo/features/webbing/catalog-assets.ts` and `catalog-assets.test.ts`: optional pointer/index client, ID matching, query contract.
- `expo/hooks/use-webbing-catalog-assets.ts`: explicit-load hook. It never fetches on mount and never surfaces errors.
- Picker: `picker-context.tsx` loads assets in `open()` next to the catalog and derives `photoUris`. `picker-sheet.tsx` passes `imageUri`, replacing the obsolete "no images" comment. `catalog-cards.tsx` hides a photo that fails to load and updates the `imageUri` comment. `legacy-models.tsx` and `webbing-catalog-specs.tsx` add the photo credit when any photo is shown.
- `expo/i18n/locales/{en-US,pt-BR}/translation.json`: new key `register-webbing.catalog.photoCredit`.

I made no changes in `next/`, no database writes and no snapshot refresh. The app doesn't use warnings.

## Source-input contract (for root and GPT Sol)

- **Input:** one clean git checkout of `emilebragard/slackdata-data`. The script records the commit and refuses a dirty checkout.
  - `--source-dir <checkout>` reads an existing checkout.
  - `--source-git [url]` makes a shallow clone; `--source-ref <40-char sha>` pins it.
- **Files read:**
  - `data/webbings.json`: nonempty array; positive unique integer `id`, `name`, nullable `brand`, optional `photos[{id, small, large}]`.
  - `data/isa_gear_warnings.json`: `{items: [...]}`.
  - `data/catalogue.json`: integer `version`.
  - every `data/*.json` except `changes.json`, copied byte for byte.
  - every file under `data/media/`.
- **Photo keys** must be under `webbings/<own id>/`. Media must be webp, jpg/jpeg, png, svg or pdf. Symlinks, unsafe paths, and missing or empty referenced files fail the run.
- **Modes:**
  - no mode flag: local build only.
  - `--dry-run`: the build plus the full rclone plan; never runs rclone.
  - `--publish`: the only mode that writes to R2.
- **Credentials:**
  - Either: `SLACKDATA_R2_ENDPOINT`, `SLACKDATA_R2_ACCESS_KEY_ID` and `SLACKDATA_R2_SECRET_ACCESS_KEY`. These are passed to rclone as `RCLONE_CONFIG_SLACKDATAR2_*` environment variables, never in argv.
  - Or: `--rclone-remote <name>` for an existing remote.
  - Both need `SLACKDATA_R2_BUCKET`. `SLACKDATA_CDN_BASE_URL` is optional and must be an https origin; it defaults to `https://cdn.chooselife.club`.

Suggested first publish for GPT Sol, using the existing `r2:` remote and bucket `chooselife` from their notes:

```sh
cd /Users/juangsandrade/Projects/chooselife
SLACKDATA_R2_BUCKET=chooselife python3 scripts/slackdata/sync.py \
  --source-git --source-ref d7cd9ab33e40689c78c628a938c4847a42aefd53 \
  --publish --rclone-remote r2 --rclone /opt/homebrew/bin/rclone --out /tmp/slackdata-publish-1
```

Then run the same command again with `--out /tmp/slackdata-publish-2` for the unchanged rerun. Expect `transfers` 0 in every pass and only the pointer rewritten, with a later `lastSuccessfulCheckAt`.

## Deviations

- **No GitHub Actions workflow.** The user's cost constraint replaces the plan's CI schedule, PR fixture job and `workflow_dispatch`. The publisher runs locally. `--dry-run` and the tests are CI-ready but not wired up. The README documents a macOS launchd LaunchAgent as an opt-in example only; nothing was installed or enabled.
- **Local lock instead of an Actions concurrency group.** `--publish` holds an exclusive `flock` (default `~/.cache/chooselife-slackdata/publish.lock`) from build through pointer read-back. It covers one machine only.
- **One rclone pass per Content-Type.**
  - Each pass sets the type explicitly rather than trusting rclone's extension guess, because immutable objects keep their first headers forever.
  - SVG is uploaded with `Content-Disposition: attachment`, so untrusted markup never renders on `cdn.chooselife.club`. The plan didn't specify this.
  - The filters are `--filter` rules, because mixing `--include` and `--exclude` has an undefined order.
- **MD5 proof.** The plan asked to verify that rclone really compares MD5 on R2. The publisher compares exact `rclone md5sum` output for every release file against local MD5s before the pointer write. An R2 that exposed no MD5 fails here instead of silently passing on size. Media is then checked with `rclone check --one-way`.
- **Extra safety I added:**
  - **Refuses older source data.** The script won't publish source older than the live `sourceCommittedAt` without `--allow-older-source`.
  - **Lost pointer response.** A lost response on the pointer write is resolved by reading `latest.json` back. If its state stays unknown, the failure says so.
  - **Storage class.** Uploads set `--s3-storage-class=STANDARD`. This follows GPT Sol's note that the free allowance is Standard-only.
- **CDN check user agent.** It sends `ChooseLife-SlackDataSync/1.0`, because GPT Sol saw Cloudflare return 403 to Python's default agent. I confirmed this agent gets 404, not 403, for the not-yet-published `slackdata/latest.json`.
- **Release ID input.** The release ID is the SHA-256 of a canonical record. That record holds the index SHA-256, each raw file's SHA-256 and the denylisted keys. Source SHA, catalogue version and schema version are inside the index.
- **Index shape.** Photo paths are upstream media keys, and `mediaPrefix` is `slackdata/media/`. The app ignores `mediaPrefix` and hard-codes `getR2PublicUrl('slackdata', 'media/' + key)`. Entries also carry `warnings` (exact webbing matches only), and top-level `warningMatches` holds the counts.
- **Diff against the previous release.** `--publish` reads the live pointer and index through S3 and reports added, removed, renamed, photo-changed and warning-changed IDs. A local build or dry-run accepts `--previous-index`.
- **Photo credit.** It is shown in the picker footer next to the SlackData attribution, and only when at least one photo resolved. Registration's `SelectedCatalogDetails` shows no photo, so it has no credit.
- **Name/brand mismatches are skipped.** `matchCatalogPhotos` returns `mismatchedIds`, but no telemetry was added; the picker just shows no photo.
- **Asset retry behavior.** A failed asset load leaves no data, so the next picker open tries again; nothing retries in the background. A success is reused for 30 minutes.

## Verification

Python 3.14.2 (Homebrew) and 3.9.6 (`/usr/bin/python3`), rclone v1.73.2 (not invoked by any check below), Node and pnpm from the repo.

| Gate | Command | Result |
| --- | --- | --- |
| Python tests | `python3 -m unittest discover -s scripts/slackdata -p 'test_*.py'` | PASS, 42 tests, exit 0. Same result on `/usr/bin/python3` 3.9.6 (40 before the upload-cutoff fix below) |
| Real backup build | `sync.py --source-dir <shallow clone d7cd9ab> --dry-run --out …` | exit 0; release `4b9c6bfd3881175023d9c1d988620d25101690a810fe379c681b2455115e7998` |
| Deterministic rebuild | the same build repeated after edits and from a different out dir | same release ID every time |
| Live source | `sync.py --source-git --source-ref d7cd9ab… --dry-run` | exit 0; same release ID |
| Diff report | `--previous-index` pointing at the same release | no added, removed, renamed or changed IDs |
| rclone filters | `rclone ls` with each pass's filters on the local media | 2,534 + 64 + 5 + 2 + 74 = 2,679 files, every file covered once |
| API consistency (read-only) | 3 paged GETs of `slackdata.org/api/webbing/`, compared with the index | 259/259 IDs present; 0 name/brand mismatches; 251 resolve to photos |
| Expo tests | `pnpm exec jest features/webbing --runInBand --watch=false --watchman=false` | PASS, 5 suites, 69 tests (18 new) |
| Expo typecheck | `pnpm exec tsc --noEmit --incremental false` | PASS, exit 0 |
| ESLint | `pnpm exec eslint <changed files> i18n/locales` | PASS, exit 0 |
| Prettier | `--check` on changed files; `--write` only on my 3 new files and `picker-context.tsx`, all clean at HEAD | PASS |
| React Doctor | `npx -y react-doctor@latest --project expo --scope files --base HEAD --include-untracked --no-score --no-supply-chain --json` | 0 diagnostics in 8 files |

Real backup results:
- Media: 2,679 files, 187,389,018 bytes, which matches the plan.
- Data: 13 raw JSON files (all except `changes.json`).
- Index: 87,817 bytes. 259 webbings, 251 with photos, 8 with at least one attached warning.
- Warning matches: exact 54, likely 11, ambiguous 10, partial 1, none 6, malformed 0.
- Webbing warnings: 9 exact attachments; 1 skipped as uncertain (Y2K, `likely`).
- Nova 54 resolves to `webbings/54/5ef8465af089d95b-480.webp` and carries warning 10 ("Do NOT use for highlining."). Nova Magic 25 (265) resolves to `webbings/265/6b6d604f26f8c624-480.webp` and has no warnings.

Python tests cover:
- ID association: Nova 54 vs Nova Magic 25 265.
- Photo order; missing and null photos.
- Exact matches attached, including several warnings on one model. Likely, ambiguous, partial and none excluded. Other gear types and unknown IDs counted. Malformed matches counted.
- Warning text kept verbatim (HTML stays literal). `productImage` and non-http links dropped.
- `changes.json` excluded.
- Same input gives the same ID. A publisher output change, a raw data change and a denylist entry each give a new ID.
- Rejected inputs: duplicate or invalid IDs, an empty catalog, traversal, absolute and backslash paths, dot segments, URLs, a photo owned by another ID, missing or empty media, symlinked files and directories, unknown media types, a dirty checkout, a missing warnings file.
- Pointer never written after failure of any media pass, the release copy, the media check, the MD5 check, a missing MD5, a CDN index miss, a wrong CDN Content-Type, an unreadable previous pointer, a missing rclone binary or an older source.
- Pointer write: a lost response is resolved by read-back; a failed write reports an unknown state.
- Every destination stays under `slackdata/`. Immutable `--checksum` copies, never `sync`. Storage class Standard. SVG served as attachment.
- Upload cutoff: every planned command carries `--s3-upload-cutoff=209715200B`, and that parses to 200 MiB under rclone's rules (a bare number means KiB), which is above the 100 MiB media cap and within S3's 5 GiB single-part limit. The real rclone accepts the generated `readPointer` argv: it gets as far as connecting to a closed loopback endpoint, with no cutoff error.
- Lock contention. Build and dry-run never invoke rclone. Publish without credentials fails before rclone. Credentials never appear in argv. Non-https CDN, bad bucket and bad remote names are rejected.

Expo tests cover:
- The pointer is fetched before the index it names.
- Rejected pointers: another host, traversal, a mismatched release, a missing path. Also rejected: HTTP errors, HTML, oversize bodies, a timeout after the 5-second budget (timers cleaned up) and parent cancellation.
- Malformed index entries and unsafe photo keys are skipped one by one.
- Nova and Nova Magic 25 match by ID. Case, accent and spacing differences are tolerated. A changed name or brand is skipped and reported. Models without photos or without assets show nothing.
- The query is memory-only, explicitly loaded, and reloaded after 30 minutes or after a failure.

**Not verified during the coding phase:**
- **R2 and CDN behavior.** No R2 upload or pointer write happened, and the CDN check was not run end to end. A missing `latest.json` has now been observed: `rclone cat` exits 0 with an empty body, and the script already treats that as no previous pointer (see the cutoff correction below). Still unobserved on R2: `md5sum` output on R2, an `--immutable` conflict, and the real Content-Type and Cache-Control on objects.
- **Native rendering.** I did not open the picker on iOS or Android. Photo rendering in both layouts, load-error hiding, the footer credit, pt-BR layout, and registration with assets unavailable are all unobserved.

## First publication attempt: upload-cutoff correction

**Real failure.** GPT Sol's first real `--publish` failed before any R2 read or write, with `s3: upload cutoff: 200Gi is greater than 5Gi`. `COMMON_FLAGS` rendered `UPLOAD_CUTOFF_BYTES = 209715200` as a bare `--s3-upload-cutoff=209715200`. rclone reads a bare size as KiB, so it asked for 200 GiB and rclone refused to build the S3 backend. The stub-rclone tests couldn't catch this, because they never parsed the flags. Nothing was uploaded and no pointer was written.

**Correction.** One argument changed in `sync.py` `COMMON_FLAGS`: `f"--s3-upload-cutoff={UPLOAD_CUTOFF_BYTES}B"`, with a comment about the KiB default. Nothing else in the script changed.

**Regression tests** (`test_sync.py`, 40 to 42 tests):
- `test_upload_cutoff_is_200_mib_as_rclone_reads_it`: every planned command must carry exactly the literal `209715200B`. A small parser that copies rclone's rule (a bare number means KiB) must read it as 200 MiB, above `MAX_MEDIA_BYTES` and no more than 5 GiB.
- `test_real_rclone_accepts_generated_flags` (skipped without rclone): runs the installed rclone with the generated `readPointer` argv. It uses the env-credential remote, an empty `RCLONE_CONFIG`, `RCLONE_LOW_LEVEL_RETRIES=1` and an endpoint on a closed `127.0.0.1` port. The test asserts there is no `upload cutoff` error and that rclone reached the endpoint, which only happens after it has built the S3 backend with every flag. No R2 or other network access.
- Mutation check: on a throwaway copy with the `B` removed, both tests fail. The real-rclone test fails with the same `200Gi is greater than 5Gi` error seen in production.

**Checks, October 17, 2026, rclone v1.73.2:**

| Check | Result |
| --- | --- |
| Loopback S3 remote, `--s3-upload-cutoff=209715200` | `CRITICAL … s3: upload cutoff: 200Gi is greater than 5Gi`. Reproduces the failure locally |
| Same with `209715200B` | gets past backend construction and fails only on `HeadObject … connection refused` |
| `python3 -m unittest discover -s scripts/slackdata -p 'test_*.py'` (3.14.2 and 3.9.6) | PASS, 42 tests |
| Read-only real R2: `rclone cat --s3-no-check-bucket --s3-storage-class=STANDARD --s3-upload-cutoff=209715200B --retries=3 --contimeout=60s --use-json-log -v r2:chooselife/slackdata/latest.json`, argv generated from `sync.COMMON_FLAGS` and `Target.path` | exit 0, empty stdout, no error lines, no cutoff error. This matches GPT Sol's read-only observation; the script already treats an empty body as no pointer |

No R2 writes, CI or commits. The Expo code is unchanged, so its checks were not rerun.

## How the run ended

### Parent cost review follow-up

The first real publication succeeded, but the first unchanged run exposed the cost of repeatedly traversing the backup's 766 directories. Official rclone S3 documentation recommends `--fast-list` with `--checksum`, using one listing page per 1,000 objects instead of a listing per directory. The Opus follow-up task failed to authenticate with Claude before making edits. The parent applied this one-flag change to `COMMON_FLAGS`, extended the existing command-contract test, documented it in the runbook, and added a local `.gitignore` for Python bytecode. Checksum comparisons, immutable copies, post-upload integrity checks, and pointer ordering are unchanged. Parent reran all 42 Python tests successfully and the read-only reviewer accepted the final change. GPT Sol verified the final version with a live unchanged run. Exact HTTP request counts have not been instrumented.

### Parent and operator live verification

- Parent independently reran 42 Python tests, all 69 mobile webbing tests, the mobile typecheck, and `git diff --check`. All passed.
- GPT Sol's first successful local publication took 652.37 seconds. It uploaded 2,679 media files, 187,389,018 bytes, and 14 immutable release JSON files, 1,425,368 bytes, plus the small pointer. Every transfer pass reported zero errors.
- The release is `4b9c6bfd3881175023d9c1d988620d25101690a810fe379c681b2455115e7998` at `https://cdn.chooselife.club/slackdata/latest.json`.
- The original unchanged rerun took 135.96 seconds. The final `--fast-list` rerun took 32.38 seconds. Both checked all 2,693 immutable files, transferred zero media/release bytes, preserved the release ID, and advanced only the pointer heartbeat. Final heartbeat was `2026-10-17T18:59:09Z`.
- Full media checks, exact release MD5 checks, public CDN probes, and exact S3 pointer read-back passed. Independent probes confirmed JSON/image/PDF/SVG content types, one-year immutable caching on release/media, five-minute pointer caching, and SVG attachment disposition.
- Parent imported and ran the actual `expo/features/webbing/catalog-assets.ts` client against the live CDN using default Node fetch. It loaded 259 models, matched Nova 54 and Nova Magic 25 265 to different photo URLs, and fetched both with HTTP 200, `image/webp`, and immutable cache headers. Their sizes were 22,412 and 2,400 bytes.
- Isolated operator tests under `slackdata/operator-tests/` proved addition, unchanged copy, and rejection of a same-size changed file with `--immutable`. Original remote hashes and the production pointer stayed unchanged. Two tiny test objects totaling 35 bytes remain. An absent image returned HTTP 404.
- Actual transient network interruption and production rollback were not induced. Failure ordering and lost pointer responses remain covered by the stub tests; rollback is documented.
- The first iOS check was blocked by a signed-out session. The user subsequently signed in. On iPhone 17, iOS 26.5, the current development app's tile picker visibly showed mirrored product photos and the separate photo credit. Searching `Nova` produced two results with distinct photos: Landcruising Nova Magic 25 and Slack Inov Nova. Nova retained its red Recall badge. Selecting Nova changed the form's model button to `Slack Inov Nova`, filled the default name, and preserved `ISA warning: Recall` in the specification panel. The picker was reopened and left showing both results with Nova selected. No registration was submitted and no webbing record was changed.
- Evidence is `/tmp/slackdata-ios-nova-verified.png` and `/tmp/slackdata-ios-nova-selected.png`. The nested sheet was absent from the iOS accessibility tree, so screenshot-based Simulator keyboard interaction was used after agent-device could not target its search field. This was an automation limitation, not a photo-loading failure.
- Android, the wide layout, pt-BR credit placement, image-load failure hiding and registration during an asset outage remain unobserved on a native device.

**LOCAL MIRROR AND iOS TILE PICKER VERIFIED. REMAINING NATIVE CASES AND APPLICATION RELEASE PENDING.**

The local manual command is ready in `scripts/slackdata/README.md`. Daily launchd setup is documented as opt-in and was not enabled. No GitHub workflow exists for this sync. Account-wide month-to-date request usage could not be read with existing credentials, so a zero R2 invoice is not guaranteed. Local execution incurs no CI runner charge. See `005-slackdata-rclone.notes.md` for detailed operational evidence.
