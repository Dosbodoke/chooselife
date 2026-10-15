# Plan 001: Integrate hosted SlackData webbing selection into Choose Life mobile

## Status and execution contract

- Priority: P1
- Effort: L, one focused coding session with sequential checkpoints
- Risk: MED, additive persistence plus registration and display changes
- Category: direction, correctness, tests
- Depends on: none
- Planned at: Choose Life commit `448c9d6`, October 14, 2026
- Authoritative artifact: `plans/001-hosted-slackdata-webbings.md`
- Execution notes: create `plans/001-hosted-slackdata-webbings.notes.md` with headings `Deviations`, `Verification`, and `How the run ended`.

Implement this entire plan in the Choose Life repository in one coding session. Do not assume access to the original conversation, a sibling SlackData checkout, a simulator, production credentials, or Docker. Complete independently executable work when an environment dependency is absent, and record the unverified gate accurately. Never substitute a production database for a missing local database.

Run `git diff --stat 448c9d6..HEAD -- expo packages/ui/src/feature/webbing packages/database supabase` first. Compare the excerpts below to the current checkout. Routine moved-line changes are not blockers; changed contracts that invalidate the design are STOP conditions. Preserve unrelated working changes. The advisor inspected untracked `next/AGENTS.md` and `next/CLAUDE.md`; they are not part of this feature.

## Outcome and agreed product decisions

Choose Life's iOS and Android users can find a known webbing by brand/model using the hosted `https://slackdata.org/api` catalog, or register manually. When a user selects a model, only that selected model's normalized details are saved with the physical webbing. Their ownership, length, loops, label, notes, static photo, and rig history stay in Choose Life.

These decisions were agreed with the user on October 14, 2026:

1. Use the existing hosted SlackData API. No self-hosted SlackData, catalog mirror, scheduled import, upstream fork, new public API, or required upstream PR.
2. Mobile native only. Expo web and browser CORS are outside this release.
3. Manual registration remains available while the upstream catalog is unavailable or missing an item. Internet access to Choose Life is still required to save; this does not authorize an offline write queue.
4. Persist selected details and source attribution. Do not durably copy the full browse catalog.
5. Saved specifications do not change automatically. No refresh button, background synchronization, or refresh scheduler in this version.
6. Preserve missing specifications as unknown. Do not invent material, construction, certification, strength, or lifetime information.
7. Show recorded usage and highline/rig history even without a supported lifetime estimate. Unknown lifetime is not a “good” assessment.
8. Support search by brand and model name.
9. Users can attach their own static image during registration and add, replace, or remove it later. Personal images belong to the physical item, not the upstream catalog.
10. The user will discuss possible lifetime support and external API expectations with SlackData maintainers. This implementation does not contact them or promise an uptime SLA.

### Chosen architecture, and why

Add a nullable, validated `catalog_snapshot` JSONB column to the existing `public.webbing` row. Imported selections set the existing local `model` foreign key to null and populate the snapshot. Legacy gear keeps its existing `model` reference unchanged; manually registered new gear can have neither.

This deliberately supersedes the earlier suggestion of importing/upserting selected rows into `webbing_model`. A per-physical-item snapshot fits the agreed “only selected details, no automatic updates” behavior and accommodates mixed/unknown specifications without migrating legacy material/weave enums or building a shared catalog. A common model can be selected by multiple users, but they each own distinct physical rows and immutable-by-application snapshots. No catalog-ID uniqueness constraint belongs on physical gear.

Identity must remain explicit:
- `webbing.id`: Choose Life physical item; all rig links keep using it.
- `webbing.model`: legacy Choose Life model ID, never a SlackData ID.
- `catalog_snapshot.sourceId`: SlackData webbing ID; scoped by source and gear type.
- `registration_key`: new optional UUID for idempotency of one registration draft, not catalog identity.

## Repository facts and existing patterns

The repository is a pnpm monorepo. Mobile package is `chooselife-mobile`; shared hooks are `@chooselife/ui`; generated database types are in `@chooselife/database`. Use Node `24.18.0` from `.nvmrc` and pnpm `11.10.0`. Do not upgrade frameworks or add an HTTP/cache/schema dependency: native fetch, TanStack Query v5, Zod, image picker, UUID, and Bottom Sheet are already installed.

Current excerpts, inspected at the planned commit:

`expo/app/(modals)/register-webbing.tsx:200` and `:410` duplicate the same query:
```ts
useQuery({
  queryKey: ['webbingModels'],
  queryFn: async () => {
    const { data, error } = await supabase
      .from('webbing_model').select('*').order('name');
    if (error) throw error;
    return data;
  },
});
```

`packages/ui/src/feature/webbing/use-register-webbing.ts:88`:
```ts
await supabase.from('webbing').insert({
  model: data.modelID ? +data.modelID : undefined,
  description: data.note,
  tag_name: data.tagName,
  user_id: userId,
  left_loop: data.leftLoop,
  right_loop: data.rightLoop,
  length: +data.length,
  strength_class: data.modelID ? undefined : data.strengthClass,
}).single();
```

`expo/hooks/use-webbings.tsx:7` queries `*, model (*), rig_setup_webbing (...)`; adding a nullable column is additive to that read. `getWebbingName` currently falls back from user tag to legacy model name.

`expo/context/react-query.tsx:69–74`:
```ts
maxAge: Infinity,
dehydrateOptions: {
  shouldDehydrateMutation: (mutation) =>
    mutation.state.status === 'pending' &&
    mutation.meta?.persistOfflineMutation === true,
  shouldDehydrateQuery: (query) => query.meta?.persistOffline === true,
},
```
Do not opt the complete upstream browse query into persistence. Its cache must remain memory-only. Do not change the global cache lifetime or unrelated offline writes.

`packages/ui/src/feature/webbing/use-webbing-usage.ts:49–78` caches a lifetime-derived result under only a physical-webbing ID:
```ts
queryKey: webbingUsageKeyFactory.byId(webbingId ?? 0),
// ...
return buildWebbingUsage(usageDays, rigCount, recommendedLifetimeDays);
```
Cache raw usage and derive the assessment from current inputs to fix metadata arrival races.

`packages/ui/src/feature/webbing/lifetime-utils.ts:52` returns `'good'` for a missing recommended lifetime. Registration calls `getRecommendedLifetimeDays` without material, silently defaulting to polyester. Remove that inference from the new registration flow.

`expo/hooks/use-webbing-photo.ts` already enforces a 10 MiB limit, uploads via `uploadToR2('webbings', ...)`, writes `image_path` scoped by owner, then best-effort deletes the old object. Reuse this lifecycle. `expo/components/settings/my-webbing.tsx:123` uses the image library with image-only media, crop, quality 0.8, and EXIF disabled.

Relevant schema:
- `supabase/migrations/20250206202200_remote_schema.sql:343`: physical webbing fields and local identity.
- Same file `:447`: `webbing.model` references `webbing_model.id`.
- Same file `:453`: INSERT policy currently permits any owner value. Tighten this one policy as part of the new registration write boundary; retain established SELECT semantics and other unrelated policies.
- `supabase/migrations/20251228150000_webbing_lifetime.sql`: existing lifetime values and usage RPC. Do not rewrite this migration or recompute historical values.
- `supabase/migrations/20261014162921_webbing_personal_photos.sql`: existing nullable `image_path`.

Conventions:
- Pure domain/network helpers and adjacent `.test.ts` files; Expo uses `~/` imports.
- Match `expo/features/highline/register-walk.ts` and its test for injectable/testable mutation logic.
- Shared Jest supports pure TypeScript under `src/**/*.test.ts`; use `packages/ui/src/feature/rig-setup/days.test.ts` as a structural example.
- Mobile Jest is Node/ts-jest and only discovers `.test.ts`; do not assume native component-rendering tests are configured.
- SQL tests use pgTAP in `supabase/tests/`, transactions, explicit test personas, role/JWT changes, and rollback. Use `supabase/tests/push_tokens_test.sql` as the fixture pattern.
- Reuse existing Button, Input, Alert, Skeleton, Text, image picker, R2 helpers, and Bottom Sheet components. Keep English and Brazilian Portuguese translations aligned.

## Research: actual hosted API contract

Rechecked with one small unauthenticated HTTPS request on October 14, 2026:
`GET https://slackdata.org/api/webbing/?limit=1&offset=0` returned HTTP 200 JSON.

The list response is a plain array, not a paginated object. Existing generic handlers accept `offset >= 0`, `1 <= limit <= 100`, default 10. They expose no name-search, brand filter, total count, next cursor, updated-since, or explicit sort parameter. Extra query parameters must not be mistaken for supported filtering. Detail is `GET /api/webbing/{positiveId}` with no trailing slash.

A reduced real response:
```json
[{
  "id": 1,
  "name": "Core 2 HS",
  "brand_name": "Landcruising",
  "material": ["Polyester"],
  "webbing_construction": "Core/Sheath",
  "width": 25,
  "breaking_strength": 44.0,
  "isa_class": null,
  "isa_certified": false,
  "isa_warning": null,
  "manufacturer_not_for_highline": null,
  "active": false,
  "stretch": "[{\"kn\":4,\"percent\":1.1},{\"kn\":6,\"percent\":1.6}]"
}]
```
The example stretch string is shortened for readability, not the complete curve. Use synthetic fixtures for test variations; retain attribution when storing a fixture adapted from upstream.

Other fields available in the inspected source: `thickness`, `weight`, `product_url`, `version`, `description`, `notes`, `colors`, `product_group`, `isa_certificate`, `manufacturer_not_for_highline_source`, and `gear_sellers`. Material is a nullable array, including combinations of Nylon, Polyester, Dyneema/HMPE, Vectran, and Other. Construction can be Flat, Tubular, Threaded Tubular, Core/Sheath, Other, or null. Retain future string values rather than force them into legacy enums. Numeric units: width/thickness mm, weight g/m, breaking strength kN. Stretch is a JSON-encoded string of numeric `kn`/`percent` points. The sample release timestamp is milliseconds; dates are not needed for this feature, so omit them instead of guessing units.

The hosted docs and OpenAPI endpoints returned 404 during research. Gear IDs are already explicit and preserved in seeds; do not invent an upstream UUID migration. The API is reachable, but a supported third-party stability/uptime contract has not been established. Pagination lacks explicit ordering/snapshot revision: deduplication protects against repeated rows, not every possible concurrent-change omission. Treat browsing as a best-effort catalog, never a comprehensive inventory guarantee.

Cloud executor references, all accessible without the sibling checkout:
- [SlackData generic handler source at inspected commit](https://github.com/International-Slackline-Association/SlackData/blob/dd8a2bb8a6e856ca659d13744da93b0846d94f1e/slack_data/api/routers/_crud.py)
- [Webbing response model](https://github.com/International-Slackline-Association/SlackData/blob/dd8a2bb8a6e856ca659d13744da93b0846d94f1e/slack_data/models/webbing.py)
- [Read-only route/docs policy](https://github.com/International-Slackline-Association/SlackData/blob/dd8a2bb8a6e856ca659d13744da93b0846d94f1e/slack_data/api/routing.py)
- [Stable seed identities](https://github.com/International-Slackline-Association/SlackData/blob/dd8a2bb8a6e856ca659d13744da93b0846d94f1e/slack_data/load_data/_seed_io.py)
- [Native networking](https://reactnative.dev/docs/network): native applications do not use browser CORS. HTTPS is used here.
- [TanStack cancellation](https://tanstack.com/query/latest/docs/framework/react/guides/query-cancellation): propagate the supplied signal to fetch.
- [TanStack defaults](https://tanstack.com/query/latest/docs/framework/react/guides/important-defaults): explicitly set feature freshness/retry behavior.
- [BottomSheetFlatList](https://gorhom.dev/react-native-bottom-sheet/components/bottomsheetflatlist): use its integrated virtualized list.
- [Supabase JSONB](https://supabase.com/docs/guides/database/json): appropriate for this versioned, selected specification snapshot; physical inventory remains relational.
- [Supabase insert](https://supabase.com/docs/reference/javascript/insert): explicitly select returned fields for a newly created row.
- [Expo image picker](https://docs.expo.dev/versions/latest/sdk/imagepicker/): restrict picker media; cancellation is a normal result.
- [Supabase changelog](https://supabase.com/changelog): the lightweight changelog endpoint failed during research; the official changelog page loaded. Recheck relevant CLI changes before running schema commands.

### Attribution and assets

[SlackData LICENSE-DATA](https://github.com/International-Slackline-Association/SlackData/blob/dd8a2bb8a6e856ca659d13744da93b0846d94f1e/LICENSE-DATA) applies CC BY-SA 4.0 to API-served catalog data and excludes product/manufacturer images. [Official terms](https://creativecommons.org/licenses/by-sa/4.0/legalcode.en) apply to reuse; HTTP access does not remove obligations.

Display “Gear data from SlackData by the International Slackline Association, CC BY-SA 4.0” with links to `https://slackdata.org` and `https://creativecommons.org/licenses/by-sa/4.0/` in the picker and selected-source details. Indicate that fields were normalized for display. Preserve source attribution on saved snapshots. No upstream images, manuals, logos, or scraped assets are imported or hotlinked. Personal photos remain the user's own assets. Do not claim that snapshots are official current certification or that all Choose Life code/user records inherit the data license; that is not established by this plan.

## Internal interfaces to implement

Keep new modules small and webbing-specific. Public signatures below are target contracts; avoid creating a generic integration/plugin framework.

### Shared snapshot and resolved display

Create `packages/ui/src/feature/webbing/catalog-snapshot.ts` with Zod validation, exported types, and pure helpers. No React, native imports, fetch, Supabase calls, or runtime import from `@chooselife/ui`'s barrel in pure tests.

```ts
type WebbingCatalogSnapshot = {
  schemaVersion: 1;
  source: 'slackdata';
  gearType: 'webbing';
  sourceId: number;       // positive safe integer
  sourceUrl: string;      // constructed fixed upstream detail API URL
  retrievedAt: string;    // valid ISO UTC string; actual fetch time, not submit time
  attribution: string;
  licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/';
  normalizationVersion: 1;
  name: string;
  brandName: string | null;
  version: string | null;
  materials: string[] | null;
  construction: string | null;
  widthMm: number | null;
  thicknessMm: number | null;
  weightGramsPerMeter: number | null;
  breakingStrengthKn: number | null;
  stretch: { kn: number; percent: number }[] | null;
  productUrl: string | null;
  active: boolean | null;
  isaCertified: boolean | null;
  isaClass: string | null;
  isaCertificate: string | null;
  isaWarning: string | null;
  manufacturerNotForHighline: boolean | null;
  manufacturerNotForHighlineSource: string | null;
};
```

Provide:
- `parseWebbingCatalogSnapshot(value: unknown): WebbingCatalogSnapshot | null`: never throw during rendering; unknown future snapshot versions become unsupported/null, not a cast.
- `resolveWebbingSpecs({catalog_snapshot, model, strength_class})`: snapshot first when valid, legacy model next, otherwise unknown. Personal strength can be shown as explicitly user-entered; catalog certification is separate, never overridden into an “ISA certified” badge.
- `getWebbingDisplayName` or extend existing `getWebbingName`: user label first, snapshot name next, legacy name next, existing unknown translation last.
- Catalog snapshot must not contain recommended lifetime. Valid legacy lifetime values remain available to existing records, clearly distinct from new catalog data.

Do not truncate mixed fibers to the first material or encode unknowns as polyester/flat. Store only listed normalized fields; no arbitrary upstream response blob or user data mixed into the snapshot. Set absent optional values to null. Unknown string enums remain strings. Finite positive specification numbers only; zero/invalid optional numbers become unknown with non-sensitive validation diagnostics. Stretch: safely JSON-parse, accept finite nonnegative point values, otherwise null plus a warning; never execute text. Required missing/invalid identity or name rejects the record. Unknown added fields are ignored, not fatal. URLs retained for linking must be HTTP(S); source/detail and license URLs are constructed constants.

### Native hosted catalog client

Create `expo/features/webbing/catalog-client.ts`, adjacent tests, and `expo/hooks/use-webbing-catalog.ts`.

```ts
type CatalogResult = {
  items: WebbingCatalogSnapshot[];
  fetchedAt: string;
  invalidRecordCount: number;
  degradedFieldCount: number;
};
fetchWebbingCatalog({
  signal, fetchImpl = fetch, now = () => new Date()
}): Promise<CatalogResult>;
filterWebbingCatalog(items, query): WebbingCatalogSnapshot[];
```

Use a fixed `https://slackdata.org/api` constant. Inject fetch/time in tests; no runtime user-selected host, API key, auth headers, cookie, tracking payload, or request body. No Supabase service key in clients.

Request algorithm:
1. Fetch `/webbing/?offset=0&limit=100`, then offsets 100, 200, etc., sequentially.
2. Stop when the RAW response array contains fewer than 100 records, even if some normalized records were rejected. Raw length drives offset, not accepted item count.
3. Deduplicate positive IDs, retaining the first observed record. Sort the completed collection locally by normalized brand/name with ID as a deterministic tiebreaker.
4. Maximum 20 pages per attempt and 30 seconds total. Each request has a 10-second timeout bounded by the remaining total budget. If the cap is reached with a full page, fail explicitly rather than claiming a truncated catalog is complete.
5. Link TanStack's parent abort signal to a local AbortController used for timeout. Clear timers/listeners in finally. Parent cancellation must not be reported as a catalog outage.
6. Check HTTP success, JSON parsing, and top-level array. Reject HTML, object envelopes, invalid JSON, and responses over a reasonable decoded 5 MiB per-page bound. This post-read bound is not a streaming hard memory guarantee. Do not silently use partially fetched pages after a later page fails.
7. Reject a nonempty response batch/catalog with zero valid records as schema mismatch. If only some rows/fields are invalid, return usable results plus warning counts; communicate catalog incompleteness. Do not emit complete response bodies to logs.
8. No automatic retries or polling. Typed errors distinguish network, timeout, HTTP, rate-limit, schema, and pagination limit. For 429/503, parse Retry-After seconds or HTTP date, default to 60 seconds when absent/malformed, cap a displayed cooldown at 5 minutes, and disable manual Retry until the chosen cooldown elapses. State it is a retry suggestion, not an upstream quota.
9. Search locally and case/diacritic-insensitively across brand, name, and version. Split trimmed query into tokens; require all tokens to match the combined string. Searching never issues a request per keystroke.
10. Include discontinued models because users can own them; show “discontinued” when active=false. Do not treat active=null as discontinued.

Query options: source/version-specific key `['webbing-catalog', 'slackdata', 1]`, `staleTime` 30 minutes, `gcTime` 60 minutes, `retry: false`, `refetchOnMount: false`, `retryOnMount: false`, window-focus/reconnect refetch disabled, `meta.persistOffline: false`. Fetch when the picker first opens, not at application startup. Reopening after a failed attempt must leave Retry explicit and must not bypass a pending cooldown; do not let an enabled false-to-true transition silently retry. A query kept disabled with an explicit first-open load action is acceptable, provided the shared cache tracks whether an attempt/result already exists. Reopening fresh memory cache issues no request. Stale memory cache remains visible with saved timestamp and an explicit refresh/retry action; refresh failure retains the previous complete data. Clear form selection only on explicit user action. A selected snapshot is copied into the draft and must not be silently replaced by a catalog refetch. There is no disk-persisted complete catalog and no offline catalog guarantee after restart.

### Registration and write contract

Retain the existing form's length, loops, label, notes, and optional strength. Add a mutually exclusive catalog selection and legacy model ID, plus one draft UUID registration key. Manual mode has neither; selecting catalog clears legacy ID; selecting legacy clears catalog selection. The main picker defaults to SlackData results, with a small “Previously available models” section/list for existing local models so legacy/manual workflows remain accessible. Legacy fetch failure must not hide upstream results, and upstream failure must not hide legacy/manual choices.

Extend the shared registration payload with optional `catalogSnapshot` and `registrationKey`. Validate the snapshot with the shared schema, validate local model ID as a positive safe integer, and reject mutually conflicting values. Validate length with Number plus finite/positive checks; do not accept a partially parsed string such as “20abc”. Do not silently change whether fractional meter lengths are accepted: existing storage is numeric and current submit uses Number, so valid positive fractional meters are supported.

Return the created/recovered physical row fields `id, user_id, image_path, registration_key` from the mutation via an explicit `.select(...).single()`. Update the hook return type and onSuccess result signature without changing unrelated callers.

Add a pure `register-webbing` mutation helper adjacent to the shared hook, with a narrow injected repository interface and adjacent tests. Implementation wraps Supabase at the hook boundary, following existing error conventions. Pass the same draft registration key for all retries. For a given owner/key:
- First look up an existing row and recover it if the payload represents the same draft.
- Insert if absent. The unique database key is the authority, not check-then-insert.
- On that named unique-conflict, or an ambiguous transport failure after an insert, look up the same owner/key and recover a matching row. If the lookup itself fails, keep the same key and report that save status could not be confirmed; do not insert again until a successful reconciliation. Do not swallow unrelated constraints/errors.
- A recovered row must not be overwritten, particularly its saved snapshot. If length/label/loops/notes/model/snapshot/personal strength differ for the same key, report a draft conflict. Generate a new key only when intentionally starting a new registration, never on photo retry or error.
- Prefer a compact deterministic comparison of the canonical insert payload; exclude photo fields which may already have changed. No destructive upsert.
- Disable double submission while creating/recovering the item.

For imported selections `model=null`, `catalog_snapshot=<validated snapshot>`. Preserve user-entered strength in `strength_class`, marked as user-provided in presentation. If a catalog/legacy class exists, show it separately or lock the default display without converting it into personal certification. A selected model with no class must not cause an editable personal value to be discarded.

## Additive database migration

Use the installed Supabase CLI's discovered `migration new webbing_catalog_snapshot` command to obtain the filename. Do not change old migrations or seed files.

Add:
- `public.webbing.catalog_snapshot jsonb null`.
- `public.webbing.registration_key uuid null`.
- A unique partial index on `(user_id, registration_key)` where the key is non-null. Legacy rows remain null; multiple physical items selecting the same source ID remain legal.
- A CHECK allowing SQL NULL snapshots or a bounded JSON object with schemaVersion=1, source=slackdata, gearType=webbing, positive integer sourceId, nonempty name, and no simultaneous legacy `model`. Use explicit type/key checks: PostgreSQL CHECK accepts NULL, so missing required JSON keys must evaluate false, not unknown. Keep full optional-field validation in Zod; do not install a new JSON-schema extension. Bound snapshot text to 64 KiB.
- A column comment distinguishing upstream saved metadata from personal or current verification data.
- Tighten only the existing authenticated webbing INSERT policy to `WITH CHECK ((select auth.uid()) = user_id)`. Verify no other permissive INSERT policy defeats it. UPDATE ownership already exists. Do not broaden reads or change established rig-sharing policies.

No new SQL function, SECURITY DEFINER, Edge Function, catalog table, enum migration, scheduled task, or GIN index is needed. Keep saved snapshots immutable through this app's write paths; this does not promise tamper-proof records against owners directly editing their own data. If a future product requires such guarantees, it is separate work.

Regenerate `packages/database/database-generated.types.ts` against a disposable local schema and include exact nullable Row/Insert/Update fields. `expo/utils/database.types.ts` is a re-export; do not duplicate it. If local database generation is unavailable in cloud, a narrowly scoped temporary manual update of the generated field declarations may keep implementation typecheckable, but mark generation and SQL execution UNVERIFIED in notes; do not claim the migration is validated. Do not generate against production.

## Mobile presentation and personal photos

Replace the inline catalog queries with the centralized hook and shared resolver. Keep local legacy models a separately keyed query. Use `BottomSheetFlatList` with two columns, stable source+ID keys, search input, and proper keyboard/bottom-sheet gesture behavior. Reuse installed components; no new list library or gesture redesign. Remove the selected-button memo or include every read dependency, including catalog results. Do not recompute the selected draft from whichever list last loaded.

UI states:
- Initial loading: indicator/skeleton, manual option stays usable.
- No successful data and error: concise unavailable message, Retry respecting cooldown, manual/legacy alternatives.
- Offline/paused before first load: offline explanation, no indefinite spinner, manual draft entry possible, saving disabled until Choose Life connectivity returns.
- Successful empty catalog vs no search matches: distinct text; neither a blank grid.
- Last complete data retained after refresh error: show stale timestamp and warning.
- Some invalid/degraded records: show a concise incomplete-data notice, preserve valid models and manual option.
- Selecting/clearing/changing a model does not erase a user-customized tag or personal image. Prefill label only when blank or still equal to the prior automatic suggestion.
- Selected upstream source and normalized fields are visible before save. Manufacturer not-for-highline=true gets a prominent sourced warning; null means not recorded, never “approved”. Catalog warning text stays visible. No new compatibility or “safe for highline” calculation.
- Tapping external links uses native Linking with validated HTTP(S) URLs; no HTML renderer.
- Attribution appears both in selection and saved detail, including saved retrieval date.

Create a pure photo-upload helper under `expo/features/webbing/` and use it from both `useWebbingPhoto` and registration. Keep native hook and storage wiring separate from injected pure tests. Enforce static JPEG/PNG selection; accept only those MIME types and reject unsupported/animated formats with understandable copy. Use image-only picker with existing crop/settings, EXIF false. If an asset is reported as GIF/WebP or unknown MIME, do not claim it is static from its extension. Prefer asking the user to choose JPEG/PNG over adding an image conversion dependency. Preserve the actual-bytes 10 MiB check. Validate JPEG/PNG byte signatures against the reported MIME, and reject PNG files carrying an animation-control chunk rather than assuming every PNG is static. Implement a small bounded PNG chunk walk with bounds checks, not a new image dependency; truncated/malformed chunks are invalid. Cover animated PNG and MIME/signature mismatch with synthetic test buffers.

Upload only after a physical row is created/recovered, using its existing numeric ID and owner-scoped R2 path machinery. The phase/state sequence is:
`editing -> savingItem -> uploadingPhoto? -> completed`, with `savedPhotoFailed` and `photoCommitUnconfirmed` as recoverable phases.
- Failed item save: remain editing; no upload yet.
- Item save succeeds and photo fails: keep created ID; show “Webbing saved, photo not uploaded”, Retry photo and Continue without photo. Disable item resubmission; retry only upload/update for the existing item.
- App closes after item save: item still appears in My Webbings and photo can be added there. No offline/background upload promise.
- Cancel image selection: no error; keep prior selection.
- Definitive photo database rejection: best-effort delete the newly uploaded object and keep the previously committed key. An HTTP/transport failure is not proof the write was rejected: read back image_path by owner/item before cleanup. If it equals the new path, recover success and then handle old-object cleanup. If it still equals the previous path, clean up the unreferenced new object. If read-back fails, preserve both objects, retain the attempt's new path, show an unconfirmed-save state, and reconcile before retrying any upload/delete. Never delete a newly uploaded image merely because its row-update response was lost. If read-back reveals a different concurrently committed path, do not overwrite it; refresh the row and report a photo conflict while preserving objects whose references cannot be established.
- Successful/confirmed update: best-effort remove old object after committing the new key. Deletion failure does not undo a successful row update. On recovery, use the committed row path in local cache updates rather than an earlier assumption.
- Removing the photo clears only the physical item photo; no snapshot/model changes.
- Navigate back/request review once at completed/continue, not before photo result or twice on retries.

## Usage and existing gear compatibility

Extend shared lifetime status with `unknown`; update all mappings/translations exhaustively. For missing/nonpositive supported lifetime, percentage/remaining days are unknown rather than zero remaining or zero wear. Choose nullable percentage where necessary and guard progress bars; do not introduce NaN or a green “good” default for loading/error/unknown. New imported snapshots never receive a material-based lifetime.

Refactor `useWebbingUsage` to cache raw `usageDays, rigCount` and derive `buildWebbingUsage` from current recommended lifetime outside the cached query. Expose loading/error separately. Metadata arriving later updates assessment without another RPC. Existing non-null legacy lifetime values retain existing threshold logic; this release does not certify their source or regenerate them.

In `expo/app/webbing/[id].tsx`, always show recorded usage/count and rig history for an owned item, even with unknown lifetime or no strength. Show neutral unknown copy; separate RPC error/loading from unknown estimate. Respect personal strength as an explicitly personal fallback; display catalog/legacy class with its source. In My Webbings show usage count even when no lifetime, without a progress bar or unsupported remaining-life claim. Existing photo precedence: personal photo, authorized legacy model image if available, then placeholder; imported snapshots have no upstream image.

Keep `rig_setup_webbing.webbing_id` and the existing history RPC/joins unchanged. Preserve existing legacy model references and manually entered gear. Keep private inventory caches separated from public catalog: add `meta.authScope` and owner-scoped keys to owned-webbing and shared webbing usage/history queries using the current user ID. Update photo/registration invalidation callers together. Do not persist personal query data as part of this feature. This uses the existing auth cleanup metadata rather than redesigning authentication.

## Files in scope

Existing files allowed:
- `expo/app/(modals)/register-webbing.tsx`
- `expo/app/webbing/[id].tsx`
- `expo/components/settings/my-webbing.tsx`
- `expo/hooks/use-webbings.tsx`
- `expo/hooks/use-webbing-photo.ts`
- `expo/i18n/locales/en-US/translation.json`
- `expo/i18n/locales/pt-BR/translation.json`
- `expo/README.md`, a short hosted-catalog/offline/verification note only
- `packages/ui/src/feature/webbing/{types,lifetime-utils,use-webbing-usage,use-webbing-history,use-register-webbing,index}.ts`
- `packages/database/database-generated.types.ts`
- `plans/README.md` and this plan's notes file

New files allowed:
- `packages/ui/src/feature/webbing/catalog-snapshot.ts`, `catalog-snapshot.test.ts`
- `packages/ui/src/feature/webbing/register-webbing.ts`, `register-webbing.test.ts`
- `packages/ui/src/feature/webbing/lifetime-utils.test.ts`
- `expo/features/webbing/catalog-client.ts`, `catalog-client.test.ts`
- `expo/features/webbing/photo-upload.ts`, `photo-upload.test.ts`
- `expo/features/webbing/registration-flow.ts`, `registration-flow.test.ts` if pure phase extraction is needed for the specified retry tests
- `expo/hooks/use-webbing-catalog.ts`
- `expo/components/webbing-catalog-picker.tsx` if extracting the sheet keeps registration readable
- One CLI-generated migration with suffix `webbing_catalog_snapshot.sql`
- `supabase/tests/webbing_catalog_snapshot_test.sql`

Do not touch SlackData source, unrelated Next routes/storage services, billing, map features, global query/auth behavior, old migrations, or seeds. Package/config changes require evidence that the existing tooling cannot implement a stated requirement; record that evidence rather than install a new SDK or framework by default.

## Commands and verified baseline

Run package commands from Choose Life root. Baseline: Expo `tsc --noEmit --incremental false` passed; shared-package Jest passed 17 tests; shared typecheck and scoped mobile ESLint were checked. Mobile discovery found 24 suites but the whole mobile suite was not run by the advisor. The host used Node 25 and emitted engine warnings; executor should use pinned Node 24.18.0. Watchman is unavailable in some sandboxes: pass `--watchman=false`.

| Purpose | Command | Expected |
| --- | --- | --- |
| Dependencies, only if absent in executor | `pnpm install --frozen-lockfile` | Installed without lockfile changes |
| Expo typecheck | `pnpm --filter chooselife-mobile exec tsc --noEmit --incremental false` | Exit 0 |
| Shared typecheck | `pnpm --filter @chooselife/ui exec tsc --noEmit` | Exit 0 |
| Shared tests | `pnpm --filter @chooselife/ui exec jest --runInBand --watch=false --watchman=false` | Existing + new pass |
| Webbing mobile tests | `pnpm --filter chooselife-mobile exec jest features/webbing --runInBand --watch=false --watchman=false` | New tests pass |
| Full mobile suite at finish | `pnpm --filter chooselife-mobile exec jest --runInBand --watch=false --watchman=false` | Pass, or document reproduced baseline failures |
| Mobile lint, from expo | `pnpm exec eslint 'app/(modals)/register-webbing.tsx' 'app/webbing/[id].tsx' components/settings/my-webbing.tsx hooks/use-webbings.tsx hooks/use-webbing-photo.ts hooks/use-webbing-catalog.ts features/webbing i18n/locales` | No introduced errors; include any extracted component path |
| CLI discovery, from root | `pnpm --filter @chooselife/database exec supabase --help` | Available; inspected version was 2.83.0 |
| New migration, from root | `pnpm --filter @chooselife/database exec supabase --workdir ../.. migration new webbing_catalog_snapshot` | Exactly one new file in root supabase/migrations |
| Apply to disposable local DB | `pnpm --filter @chooselife/database exec supabase --workdir ../.. migration up --local` | New migration applied; inspect --help first |
| SQL tests | `pnpm --filter @chooselife/database exec supabase --workdir ../.. test db supabase/tests/webbing_catalog_snapshot_test.sql` | pgTAP all pass; resolve test path relative to CLI workdir |
| Generate types, from root with CLI on PATH | `./supabase-gen-types.sh` | Updated shared generated types; inspect diff for unrelated drift |

Supabase `--workdir ../..` is relative to the filtered package directory `packages/database`; verify it resolves to the repository root. If CLI path interpretation differs, invoke the same installed binary from repo root with `--workdir .`. Never create a second supabase project directory. Do not run `db reset` on an existing developer/linked database. A clean local test stack may be created in the executor's disposable environment if Docker is available.

## Sequential implementation checkpoints

### 1. Prove the vertical path before the full picker

Create shared snapshot schema/resolver tests and the pure hosted client with injected fixtures. Add migration, generated types, and a registration helper that saves one fixture selection alongside a real physical row in a disposable local DB. Confirm a subsequent read displays its source/name with `model=null`; register a second owned item for the same source ID and confirm distinct physical IDs. Existing local-model gear must still resolve unchanged.

Tests first cover: snapshot acceptance/rejection, source-vs-local ID distinction, atomic selected snapshot persistence, unique registration-key retry, and legacy fallback.

Verify: shared tests + typechecks above pass; SQL tests for additive columns and separate owned items pass when local DB exists. In a cloud environment without Docker, continue client/pure mutation work, supply SQL tests and type changes, and clearly mark the real persistence gate unverified.

### 2. Complete the hosted client and bounded browse behavior

Implement the exact request/cache/search contract and tests. Use synthetic multi-page fixtures, not live bulk downloads. Inspect one live sample only if network is available; runtime feature must target the hosted base, never localhost. Do not depend on that request in CI.

Verify: `pnpm --filter chooselife-mobile exec jest features/webbing/catalog-client.test.ts --runInBand --watch=false --watchman=false` passes. Tests assert the sequence of requested offsets and count; no authentication/body sent.

### 3. Integrate selection and idempotent registration

Replace duplicate picker queries, add search and all recovery states, preserve draft snapshot/tag/image, and connect one owned-item registration. Keep legacy fallback section and manual mode independent. Wire owner-scoped invalidations and shared mutation result handling. Add source information and snapshot specifications to detail/My Webbings.

Verify: shared registration tests, mobile typecheck, scoped lint, and tests for selected-before-data/name-change behavior. A pure state/resolver test is acceptable with current Jest; native sheet behavior still requires the device checklist below.

### 4. Add photo phases without repeating item creation

Extract/reuse upload lifecycle, accept JPEG/PNG, preview/clear draft image, and implement the created-ID recovery flow. Keep the existing later photo controls working.

Verify: injected photo and registration-flow tests prove save once + photo retry twice yields one owned-item insert; failure/replacement cleanup preserves the committed row and previous image. Mobile typecheck/lint pass.

### 5. Correct unknown lifetime and raw usage derivation

Extend status/formatting and refactor raw usage caching. Update detail and My Webbings to show counts without lifetime. Add explicit loading/error handling and source-aware personal strength rendering.

Verify: shared lifetime tests and typechecks pass, including metadata changing null -> known without another usage fetch, and unknown lifetime never produces a good badge or remaining-life figure. Existing threshold cases stay covered.

### 6. Review and hand off

Run all available gates once. Read the final diff against scope. Update the plan index and notes with exact passed/failed/not-run gates, unresolved environment blockers, and the manual checklist status. Do not claim full product verification when SQL/device gates were not run. Do not deploy, push, merge, change hosted data, or contact maintainers.

## Required test matrix

### Client and snapshot contract
- 100/100/59 records -> offsets 0/100/200; exactly 200 records -> final empty page at offset 200.
- A page with invalid rows still advances by 100 raw records.
- Duplicate IDs across pages dedup; 20 full pages fail, not truncate.
- Empty result vs nonempty all-invalid result distinguished.
- Network failure, JSON/HTML/object response, timeout, parent cancel, cooldown, and later-page failure.
- Old complete data retained after refresh failure; searching/refining/reopening fresh OR stale cached data makes no extra requests. Reopening after failure does not automatically retry or bypass cooldown.
- Mixed fibers, Vectran, core/sheath, unknown future strings, null fields, zero dimensions, malformed stretch, and extra fields.
- Brand+model token search with accents and whitespace; discontinued models remain findable.
- No credentials/personal payload sent upstream; no disk persistence for browse results.

### Registration, database, and ownership
- Manual, legacy, and catalog modes each create correct shape; simultaneous model+snapshot rejected.
- Existing model and rig foreign keys unchanged; new snapshot defaults null for old inserts.
- Same upstream model permits two owned items; same registration key for same owner recovers one item.
- Unique conflict/ambiguous response recovery does not overwrite snapshot; mismatched draft conflicts.
- Positive fractional length valid; empty, negative, Infinity, and trailing text invalid.
- Personal strength persists for missing-model-class selection and is not displayed as ISA certification.
- Snapshot constraints reject missing required keys/scalar/oversize/conflicting legacy model.
- Authenticated user cannot insert another owner's item; owner can insert; anon cannot write.
- SQL tests use test personas and rollback, never live users.
- Inventory query keys/metadata differ by user; public catalog remains shared.

### Usage and photos
- Unknown lifetime renders neutral unknown and usage/count remain available.
- Loading/error never imply zero use or good condition; raw history RPC failure has retry/error treatment.
- Legacy supported lifetime threshold cases remain unchanged; changes to lifetime input recompute cached raw usage.
- JPEG/PNG accepted, unsupported/animated/unknown-MIME images rejected, cancelled picker harmless, actual-byte size bound enforced.
- Item save failure -> zero photo uploads.
- Item success/photo failure -> retry same item photo, never reinsert.
- Definitive update rejection cleans up the new object and preserves the old key; response-lost-after-commit recovers the new key; failed read-back preserves objects and reconciles before retry; concurrent different path is a conflict. Successful replacement commits/confirms the new key before old deletion; remove leaves source/specs unchanged. A lost remove response also requires read-back before assuming whether removal committed.

## Native end-to-end acceptance checklist

Requires an authenticated development build and test backend; never pretend Node tests prove native rendering. On both iOS and Android when available:
1. Open registration, search brand+model, select a mixed-material/discontinued model, edit label/length/loops, select JPEG/PNG, save, reopen My Webbings/detail. Snapshot, personal data, attribution, photo, and units are correct.
2. Register two physical webbings from one model; lengths/photos/history stay separate.
3. Simulate upstream failure with a test-injected transport, while Choose Life backend is healthy. Manual registration works, previously selected draft remains usable, Retry works after cooldown, and no full-catalog copy is written.
4. Restart without upstream connectivity. Saved gear specs/history can be fetched from Choose Life; browse catalog is not promised. With full device offline, show the existing offline behavior; saving is unavailable, not silently queued.
5. Change fixture upstream specs after saving. Existing owned item remains unchanged; new registration can capture newer details.
6. Fail photo upload after item save, retry/continue, confirm exactly one item. Replace/remove later and confirm source snapshot untouched.
7. Open legacy gear and manual gear; names/photos/rig links remain valid.
8. Switch test accounts; previous owner's inventory is not reused from client cache.
9. Inspect bottom-sheet search keyboard, scrolling, selection, accessibility labels, and English/Portuguese layouts.

## Done criteria and cloud-session finish states

- [ ] Hosted client only uses fixed SlackData HTTPS base and read-only requests.
- [ ] Only user-selected normalized snapshot persists; browse catalog is memory-only.
- [ ] Every agreed product decision is implemented without a new self-hosted service.
- [ ] Added migration is additive, generated declarations include exact fields, and local SQL tests pass OR are explicitly UNVERIFIED due to environment.
- [ ] All new pure client/snapshot/registration/photo/lifetime tests pass.
- [ ] Expo/shared typechecks pass and changed-file lint has no introduced errors.
- [ ] Full mobile tests pass or documented pre-existing failures are reproduced on baseline.
- [ ] Native checklist is passed or marked NOT RUN with the specific unavailable environment.
- [ ] No out-of-scope source changes; no credentials, seed import, upstream asset reuse, deployment, or external messages.
- [ ] Notes include deviations, verification evidence, and one finish state; index updated.

Finish as one of:
- DONE: code and all required SQL/device checks passed.
- IMPLEMENTED — VERIFICATION PENDING: code and available automated checks passed; name SQL/device gates unavailable in cloud. This is a valid cloud handoff, not a claim of production readiness.
- BLOCKED: a specific contract or environment issue prevented required code work; preserve completed work and state exactly what unlocks it.

## Recovery, rollout, and maintenance

Ship the additive database migration before enabling the new mobile build. Older mobile binaries tolerate nullable new columns. A rollback should disable the new catalog selection/revert the mobile change while retaining saved snapshot columns and physical gear; do not drop user data to roll back. Old builds may not display imported model names because model=null, but tag_name is always saved and existing gear/rig links remain intact.

Do not use snapshots for live recall monitoring or current safety approval. They are saved catalog information with retrieval time. A future refresh or recall feature requires a separate product decision and potentially new upstream support. A future shared model catalog is also a separate migration, not a prerequisite now.

The single-session implementation may need a follow-up device/database verification session; no plan can guarantee a cloud environment supplies those capabilities. Keep the code/test work complete and the verification distinction explicit.

## STOP conditions and conservative deviations

Stop and report if:
- Upstream has removed public read access or fundamentally changed required identity/name/list semantics. Do not scrape the website or self-host as a workaround.
- Implementing this requires production credentials, a production reset, or changes to SlackData.
- Current schema no longer has the physical webbing/local-model distinction or personal-image path assumed here.
- A real caller requires an unplanned breaking public API change that cannot be preserved with optional/additive fields.
- A requested fix would erase existing gear/history or overwrite snapshots on retries.
- The installed image picker/upload service cannot support existing owner-scoped static photo writes without changing out-of-scope storage routes.

A missing simulator, Docker, external network, or code-generation service is a verification limitation, not permission to fake success or abandon independent code work. Log it, complete the safe remaining scope, and leave the corresponding gate pending. Routine helper naming/moved-line differences can be resolved conservatively and logged; do not reopen agreed product choices.
