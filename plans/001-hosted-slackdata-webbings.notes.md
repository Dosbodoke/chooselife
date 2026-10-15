# Plan 001 execution notes

Executed October 14–15, 2026 on `develop` (working tree, uncommitted), starting from `41b59cb`. `git diff --stat 448c9d6..HEAD` showed no changes to webbing code, shared webbing hooks, `packages/database` or `supabase/`, only Expo build/config files, so there were no STOP conditions. One live request (`GET https://slackdata.org/api/webbing/?limit=1&offset=0`, HTTP 200, plain JSON array) confirmed the contract described in the plan. No other live upstream requests were made, and tests use synthetic fixtures only.

## Deviations

- **Generated types were spliced, not wholesale replaced.** `supabase gen types --local` ran against the local stack after the migration. But the committed `database-generated.types.ts` already lags the schema in unrelated tables (for example `choosen_course_entitlements` and `festival_companion_*`; about 170 diff lines). To stay in scope, only the generated `public.webbing` block was copied in verbatim (`catalog_snapshot: Json | null`, `registration_key: string | null`, Row/Insert/Update). The unrelated drift is left for a separate regeneration.
- **The local DB was also missing the existing `20261014162921_webbing_personal_photos.sql`.** `migration up --local` applied it together with the new migration. Both are additive. Only the local stack was touched; stage and production were not.
- **The new migration has a CLI-generated timestamp `20261015013845`** (UTC clock), which is later than the plan date.
- **Hook return shapes changed (no outside callers).**
  - `useWebbingUsage` now returns `data: WebbingUsage | null` (plus `record`). `DEFAULT_WEBBING_USAGE`, a zero-use "good" placeholder, was removed.
  - `WebbingUsage.percentageUsed` is now nullable, and the type gains `remainingDays`.
  - The webbing usage and history key factories now take a viewer ID.
  - The only callers were `app/webbing/[id].tsx` and `components/settings/my-webbing.tsx`, and both were updated. `next/` does not import these.
- **Owner-scoped inventory keys.**
  - `useWebbingsKeyFactory` is now `webbings(viewerId)` / `webbing(viewerId, id)` with `meta.authScope`.
  - `all()` keeps the `['webbings']` prefix for invalidation.
  - Its only key consumer outside `use-webbings.tsx` was `use-webbing-photo.ts`, which was updated.
- **`useRegisterWebbing` additions.**
  - It gained `submit()` and a `createRegistrationKey` option.
  - The mobile screen passes `uuid`, and `onSuccess` now receives the created/recovered row. The existing `handleSubmit` is kept.
  - The `@chooselife/ui` package has no `uuid` dependency, so key creation is injected instead of adding one.
- **Picker layout.** "Previously available models" is the list footer below the SlackData grid. The manual option is a button at the top of the sheet. Catalog items show a neutral placeholder icon because no upstream images are used.
- **Rate-limit handling and status classification.**
  - A `cancelled` catalog error kind is surfaced so parent cancellation never renders as an outage.
  - Ambiguous-vs-definitive write errors are classified by the presence of a Postgres/PostgREST error code. This matches supabase-js, which returns `code: ''` on transport failure.
- **No ESLint for `packages/ui`.** It has no ESLint config (ESLint 9 finds none), so changed shared files were covered by `tsc` and Jest only. This predates this work.
- **Formatting.** Prettier was applied only to the mobile files I changed or created; those files were Prettier-clean at HEAD. Shared-package files were not reformatted, because they were not Prettier-clean at HEAD.
- **Unused legacy helper kept.** `getRecommendedLifetimeDays` is still exported but no longer called by registration. Material inference was removed from the new flow, as the plan required.

## Verification

Node `v24.18.0` from `.nvmrc`, pnpm `11.10.0`, Supabase CLI `2.83.0` (repo-installed binary), and a local Docker (OrbStack) Supabase stack.

| Gate | Command | Result |
| --- | --- | --- |
| Shared tests | `pnpm --filter @chooselife/ui exec jest --runInBand --watch=false --watchman=false` | PASS: 4 suites, 49 tests (17 baseline + 32 new) |
| Shared typecheck | `pnpm --filter @chooselife/ui exec tsc --noEmit` | PASS |
| Expo typecheck | `pnpm --filter chooselife-mobile exec tsc --noEmit --incremental false` | PASS |
| Webbing mobile tests | `pnpm --filter chooselife-mobile exec jest features/webbing ...` | PASS: 3 suites, 43 tests |
| Full mobile suite | `pnpm --filter chooselife-mobile exec jest --runInBand --watch=false --watchman=false` | PASS: 27 suites, 255 tests |
| Mobile lint | `pnpm exec eslint <changed files incl. components/webbing-catalog-picker.tsx> features/webbing i18n/locales` (from `expo`) | PASS, 0 problems |
| Migration created | `pnpm --filter @chooselife/database exec supabase --workdir ../.. migration new webbing_catalog_snapshot` | One file: `supabase/migrations/20261015013845_webbing_catalog_snapshot.sql` |
| Migration applied (local only) | `... supabase --workdir ../.. migration up --local` | PASS |
| SQL tests | `node_modules/.bin/supabase --workdir . test db supabase/tests/webbing_catalog_snapshot_test.sql` | PASS: 29 pgTAP assertions |
| Type generation | `supabase gen types typescript --local --schema storage,public,functions` | Ran. Webbing block applied; see Deviations |
| Local PostgREST end-to-end (temporary) | Throwaway Jest test using real supabase-js + `createWebbingRegistrationRepository` against `127.0.0.1:54321`, with a disposable auth user | PASS, then deleted the test file and user (verified 0 leftover users/rows) |

The plan's `--workdir ../..` form of `test db` found zero test files, because the test path is not resolved relative to the workdir. The same installed binary run from the repo root with `--workdir .` executed them, as the plan's fallback allows.

The local end-to-end check proved the following through the real API:
- A catalog selection is saved with `model = null`, `length = 100.5`, and personal strength `B`.
- A retry recovers the same row.
- A raw duplicate returns `23505` naming `webbing_user_id_registration_key_idx`.
- The lookup-miss → unique-conflict → recover path works.
- A changed draft under the same key yields `draft-conflict`.
- A second key for the same source ID creates a distinct physical item.
- The read-back resolves to "Landcruising Core 2 HS".
- An insert for another owner is refused with `42501`.

Test-matrix coverage:
- **Client.** Covered by `catalog-client.test.ts`: offsets 0/100/200 for 100/100/59, a final empty page for exactly 200, raw-length advance, dedup, the 20-page failure, empty vs all-invalid, HTML/object/invalid JSON/oversize, network/HTTP/429/503 with cooldown, timeout with timer cleanup, parent cancel, later-page failure, accent/token search, discontinued models, an anonymous GET-only request shape, memory-only options, first-open-only loading, failed cache not auto-retrying, and stale data retained after a refresh failure.
- **Snapshot.** Covered by `catalog-snapshot.test.ts`.
- **Registration.** Covered by `register-webbing.test.ts` and SQL.
- **Lifetime.** Covered by `lifetime-utils.test.ts`.
- **Photos.** Covered by `photo-upload.test.ts` (synthetic JPEG/PNG/APNG/GIF buffers).
- **Phases.** Covered by `registration-flow.test.ts`: save once + two photo retries → one item save.

**Native end-to-end checklist: NOT RUN.** No authenticated development build or simulator/device session was used. The Expo dev `.env` points at production, and saving test data there is prohibited. All 9 checklist items remain open. They need a development build pointed at local or stage, ideally on both iOS and Android, with test accounts. Rendering, bottom-sheet keyboard/gesture behavior, accessibility, pt-BR layout and real R2 uploads are unverified.

## How the run ended

**IMPLEMENTED — VERIFICATION PENDING.**

All code, the migration, SQL tests, generated declarations and translations are in place. Every automated gate passed, including SQL against a local disposable stack and a local PostgREST round trip. The native acceptance checklist was not run, as described above. Nothing was committed, pushed, deployed, or applied to stage or production, and no SlackData maintainers were contacted.

Rollout reminder from the plan: apply the additive migration before shipping the mobile build that writes `catalog_snapshot` / `registration_key`.

## Image-free picker follow-up, October 15, 2026

The user confirmed that catalog images are unavailable and asked for an image-free UI. Removed catalog image placeholders from the cards and selected model field. Local models with an actual image retain it; models without one no longer reserve image space. Cards now align text to the left, allow brand/model/material text to wrap, and show a check for the selected catalog item. The search field stays above the scrolling list.

Three interactive browser layouts were captured on the local throwaway branch `prototype/webbing-picker-no-images`, commit `7c0ddb9`: A, a single-column list; B, compact text cards; C, expandable brand groups. The artifact lives beside the native component as `expo/components/webbing-catalog-picker.prototype.html`, with a small Python server and a README. In that branch/worktree, `pnpm prototype:webbing` serves `/prototype/webbing-model?variant=A|B|C` on port 8082. The native-only registration route is represented by a browser harness with 11 attributed sample records and in-memory interactions. No prototype code was added to `develop`. This note is the local context pointer because no implementation issue was supplied.

The accepted decision is to remove placeholders. The native app keeps the familiar grid as compact text cards while the broader layout choice remains available for user comparison. The prototype recommends A for scanning and long names; no claim of user approval for that layout is made.

Follow-up checks: changed-component ESLint, Expo TypeScript, and whitespace checks pass. Browser checks cover all three layouts, tokenized search, selection retained across variants, empty results, manual entry, model confirmation, query-param switching, and arrow keys without stealing input cursor keys. Desktop and mobile HTML previews rendered without script errors. No prototype tests were added.

The iPhone 17 development build was reconnected to Metro with local Supabase overrides, and the actual registration picker was opened. A screenshot confirmed text-only cards, the fixed search field, and wrapped mixed-material labels. No registration was submitted. This checks the changed appearance only; it does not complete Plan 001's full native acceptance checklist.

Image availability, owner terms, and hosting requirements are documented in [webbing-catalog-images.research.md](webbing-catalog-images.research.md). No SlackData source or infrastructure was changed.

The user subsequently requested the prototype inside the iOS simulator. A development-only native comparison is now available at `com.bodok.chooselife.dev://webbing-picker-prototype?variant=A`, with bottom arrows for A/B/C and in-memory sample selections. It uses the same 11 attributed fixture records and never submits a registration. The native route redirects away in production. Source and fixture are captured on `prototype/webbing-picker-no-images`, commit `bb4d03f`; the temporary untracked native preview files remain available to Metro in the development checkout for the user's comparison. Native preview lint and typecheck passed.
