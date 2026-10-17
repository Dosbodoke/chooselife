# Sync SlackData's backup to R2

Status: LOCAL MIRROR IMPLEMENTED, PUBLISHED AND VERIFIED. The iOS tile picker is verified; other native cases remain unverified. The user authorized implementation after the planning task, with Opus 5.5 High coding and GPT Sol handling rclone.

## Implementation update, October 17, 2026

The latest user instruction overrides this plan's original CI publishing proposal. Before creating GitHub CI, establish that it adds no costs, and prefer running rclone on the user's machine if necessary. Implementation therefore proceeds **locally first, with no new GitHub workflow**. Standard hosted runners are free for this public repository, but R2 operations and storage share account-wide allowances and cannot be guaranteed free from the pricing page alone. Running locally removes the CI dependency; it does not remove R2 charges. Provide an explicit local publish command and document opt-in macOS scheduling without enabling a background job automatically. The original CI design below remains a deferred option, not a current implementation requirement.

The local implementation and picker integration are in place. Parent verification passed 42 Python tests, 69 mobile webbing tests, the mobile typecheck, and `git diff --check`. A fresh read-only source review found no blocking issue. The first live attempt stopped before any writes because rclone interprets a suffixless upload cutoff as KiB. Opus corrected the generated flag to `--s3-upload-cutoff=209715200B` and added regression coverage against the installed rclone parser. GPT Sol published all 2,679 media files and the data release, verified the CDN and R2 hashes, and confirmed an unchanged rerun transfers zero media/release bytes. The parent added `--fast-list` after the final Opus follow-up could not authenticate; the verified repeat-run time fell from 135.96 to 32.38 seconds. Fresh review accepted this final change. After the user signed in, the iOS tile picker visibly showed distinct Nova/Nova Magic 25 thumbnails, the photo credit and Nova's Recall badge. Selecting Nova preserved the exact model and warning in the form; no registration was submitted. Android, the wide layout, pt-BR rendering and live outage behavior remain unverified. Current implementation and operating evidence are in the two Plan 005 notes files.

Prepared October 17, 2026. This file is the authoritative implementation handoff. The executor should keep `plans/005-slackdata-backup-sync.notes.md`, with `## Deviations` and `## How the run ended`, and record actual checks and deployment limits there.

## Outcome and scope

Copy SlackData's daily backup media and catalog data into Choose Life's existing R2 storage. Publish an index keyed by webbing ID so the mobile picker can show the correct product photo without guessing filenames or requesting images from SlackData at runtime. Keep the process small: one Python standard-library script, rclone, and one GitHub Actions workflow. No new server, database tables, queue, Worker, or image transformation service.

The user supplied Emile's reply: "feel free to pull the media and data from our daily backup" at `https://github.com/emilebragard/slackdata-data`. Record that exchange as the maintainer's invitation to copy this backup. It supersedes the earlier plan's instruction to wait for a maintainer response. Keep data attribution and its CC BY-SA license; credit photos to their respective owners via SlackData/ISA. Do not label photos CC BY-SA merely because the catalog data is. Preserve a source link and a straightforward removal procedure.

The existing hosted SlackData API remains the source of model specs and certification in registration. The sync does not import models into Supabase or refresh saved model snapshots. Include full warning details in the published index for a later consumer, but do not add warning refresh, push alerts, or change saved warning semantics in this work. This limits the first app change to photos.

Success means a scheduled run can publish a consistent set of files, an unchanged run transfers no existing media, failed runs preserve the last published index, and Nova and Nova Magic 25 resolve to different photos by their respective IDs. An image failure must leave registration usable.

## Evidence and cost

Inspected the earlier [integration thread](t3-thread://v1/5b01a974-6ccd-43d5-b913-b293c4026507) and the current Choose Life checkout at `b793adf`. Earlier work deliberately saves selected-model snapshots once. The picker already has an optional `imageUri` prop and uses `expo-image`.

The backup was measured at commit [`d7cd9ab33e40689c78c628a938c4847a42aefd53`](https://github.com/emilebragard/slackdata-data/tree/d7cd9ab33e40689c78c628a938c4847a42aefd53), dated October 16, 2026, 23:34:05 UTC. Counts below sum Git blob sizes from the complete, non-truncated [recursive tree](https://api.github.com/repos/emilebragard/slackdata-data/git/trees/d7cd9ab33e40689c78c628a938c4847a42aefd53?recursive=1), excluding Git history. MB and GB here are decimal units.

| Files | Count | Bytes | Size |
| --- | ---: | ---: | ---: |
| Every image, including logos | 2,605 | 105,774,896 | 105.8 MB |
| PDF manuals | 74 | 81,614,122 | 81.6 MB |
| All media, recommended mirror | 2,679 | 187,389,018 | 187.4 MB |
| Webbing photos, both sizes | 974 | 54,011,854 | 54.0 MB |
| Webbing thumbnails only | 487 | 11,273,452 | 11.3 MB |

All `data/*.json` files together add 1,338,140 bytes, about 1.34 MB. The proposed mirror excludes `changes.json`. The complete current media plus one data release is therefore about 0.189 GB before the small generated index. Copying all media avoids maintaining filters for a negligible storage saving. The backup already supplies 480px and 1600px WebP variants, so resizing is unnecessary.

Current [R2 Standard pricing](https://developers.cloudflare.com/r2/pricing/) includes 10 GB-month storage, 1 million Class A operations, and 10 million Class B operations per month. Paid rates are $0.015/GB-month, $4.50/million Class A, and $0.36/million Class B. Internet egress is free. These allowances are shared across the account, not renewed per bucket. Use Standard, which qualifies for the free tier.

- Expected incremental R2 bill: **$0/month** while the account has enough free allowance. Existing account usage was not inspected, so this is conditional.
- With no free storage left, this mirror's unrounded storage equivalent is about **$0.0028/month**. Actual billing rounds total usage up to whole billing units. Its incremental storage charge can be $0 or roughly $0.015 for a crossed GB boundary; the fractional figure is not a promised invoice.
- Initial upload needs about 2,700 object writes plus checks. Allow fewer than 5,000 Class A and 200,000 Class B sync operations in a normal month at today's size. These are conservative planning budgets, not measured run results. Image traffic is additional. Ten million uncached image GETs would consume the entire monthly Class B allowance; CDN hits reduce origin reads.
- Immutable data releases are small. Even one full 1.34 MB release every day adds about 0.49 GB/year. Media growth depends on upstream additions and must be reported each run. Do not copy the entire media folder into every release.
- Choose Life's GitHub repo is public. Standard GitHub-hosted Linux runners are free for public repositories under [GitHub Actions billing](https://docs.github.com/en/billing/concepts/product-billing/github-actions). Use `ubuntu-latest`, keep large backups out of Actions artifacts, and do not use larger runners. No new paid runtime is required.

## Source contract

The [upstream README](https://github.com/emilebragard/slackdata-data/blob/d7cd9ab33e40689c78c628a938c4847a42aefd53/README.md) and [export workflow](https://github.com/emilebragard/slackdata-data/blob/d7cd9ab33e40689c78c628a938c4847a42aefd53/.github/workflows/export.yml) say the backup runs at 03:17 UTC and commits only when something changes. An old commit date alone does not indicate a broken backup. Its exporter keeps media keys immutable and retains files no longer referenced by the catalog. Upstream history may be rewritten for erasure requests.

Check out one shallow upstream revision and read everything from that checkout. Record its full SHA, commit date, and `data/catalogue.json` version. A pinned Git revision makes our input reproducible; it does not prove the upstream export was an atomic database snapshot. Validate all references before publication. Do not fetch a separate live media manifest, mix raw `main` URLs during a run, execute the upstream exporter, or depend on our previous source commit still being an ancestor.

`data/webbings.json` is an array with numeric `id`, `name`, `brand`, and optional `photos`. It contains 259 models; 251 have photos. Its format differs from `/api/webbing/`: for example, `brand` replaces `brand_name`, and computed certification/warning fields are not joined. Do not feed these seed records directly to `normalizeSlackDataWebbing` or replace the hosted catalog client.

The [photo records](https://github.com/emilebragard/slackdata-data/blob/d7cd9ab33e40689c78c628a938c4847a42aefd53/data/webbings.json) supply paths directly. Nova is ID 54, with a small photo at `webbings/54/5ef8465af089d95b-480.webp`. Nova Magic 25 is ID 265. Use `(source=slackdata, gearType=webbing, id)` for association. Never derive an identity from a display name or array position.

`data/isa_gear_warnings.json` is an object containing `items`. Each warning can contain `status`, `description`, `solution`, links, and `match.gearType`, `match.gearIds`, `match.confidence`. [Nova's warning](https://github.com/emilebragard/slackdata-data/blob/d7cd9ab33e40689c78c628a938c4847a42aefd53/data/isa_gear_warnings.json) explicitly matches webbing 54 and contains "Do NOT use for highlining." Preserve text verbatim as plain text. Index only `exact` matches automatically, keep all warnings in the raw data release, and report ambiguous/likely/partial/unmatched counts. Support multiple warnings per model. Never infer associations from names or use remote `productImage` URLs as image sources.

## Storage and publication contract

Reuse the configured physical R2 bucket, which defaults to `chooselife` in `next/lib/storage/r2.server.ts`. The existing public base defaults to `https://cdn.chooselife.club`. Verify the deployed values before writing. The logical namespace is `slackdata`, distinct from user uploads.

```text
slackdata/media/<upstream media key>
slackdata/releases/<release-id>/index.json
slackdata/releases/<release-id>/data/<collection>.json
slackdata/latest.json
```

`release-id` is a SHA-256 digest of the deterministic generated index and selected raw JSON file contents, excluding timestamps that vary between runs. Include upstream SHA, source version, and index schema version in those inputs. A change to the publisher's output then creates a new release even when upstream is unchanged. Do not use the source SHA alone if different publisher versions can generate different bytes.

The immutable index uses schema version 1 and contains source metadata, data/media attribution, and a `webbingsById` map. Each entry has `id`, `name`, `brand`, ordered `{id, small, large}` photos, and an array of exact-match warning descriptors with status, description, solution, source links, and match metadata. Publish relative paths under a fixed Choose Life CDN base. Do not accept arbitrary URL hosts or HTML. Copy raw catalog JSON collections from `data/`, excluding `changes.json`, alongside it. No contributor log or upstream code belongs on the CDN.

`latest.json` is the only mutable publication pointer. It contains `schemaVersion`, `releaseId`, `indexPath`, `sourceCommit`, `sourceCommittedAt`, `sourceVersion`, and `lastSuccessfulCheckAt`. Update the check timestamp after an unchanged successful run too. This distinguishes publisher health from an upstream catalog that simply has no changes.

Publication order:

1. Check out Choose Life's trusted publisher code and a shallow upstream snapshot. Validate required JSON, unique positive model IDs, photo owner IDs, and safe relative media paths. Reject absolute paths, traversal, symlinks, empty referenced files, and missing references before uploading. Require a nonempty webbing catalog. Report record and warning-association changes against the previous release, including removals. A removed catalog entry stops appearing in the new index, while its existing media stays available to older releases.
2. Build the deterministic index and release locally. Check that every photo named by it exists in `data/media/`. Preserve array order; the first photo is the default thumbnail. Missing `photos` is a supported empty list.
3. Copy `data/media/` into `r2:<physical-bucket>/slackdata/media/` using `rclone copy --checksum --immutable`. Set `Cache-Control: public,max-age=31536000,immutable` and correct MIME types. Use checksum comparison so fresh checkout modification times do not cause daily uploads. Conflicting bytes at an existing immutable key fail the run. Do not use `sync`, `--ignore-existing`, or size-only checks.
4. Copy the immutable release files with checksum comparison, immutable behavior, and JSON content types. Verify destination media and release contents using `rclone check --one-way`; extras from older upstream revisions are allowed. At today's maximum file size of 10.6 MB, keep uploads below the S3 multipart cutoff so checksums remain straightforward. Verify the pinned rclone version actually compares MD5 on R2, rather than silently relying on size.
5. Confirm the immutable index and representative images are reachable through the actual CDN. Publish `latest.json` with one `rclone copyto` object write only after the checks pass. Set `Cache-Control: public,max-age=300,must-revalidate` on the pointer. Exclude it from any rule forcing long edge TTLs. Cache immutable JSON releases explicitly if desired; do not assume Cloudflare caches JSON by default.
6. Read back the pointer through S3 and confirm its expected release ID. Public clients may see the previous pointer for up to five minutes; both releases must remain valid. Write a run summary with upstream SHA/version, checked time, counts, byte totals, uploads/skips, warnings skipped for uncertain association, and published release ID.

Retries are bounded: three attempts for transient network/transfer errors, a 60-second connection timeout, and a 30-minute workflow timeout. Validation and immutable-key conflicts fail immediately. A failure before the pointer write leaves the previous release live. If the final write's response is lost, read back its release ID to determine whether publication succeeded before retrying. Retrying the same input is safe. No daily deletion or garbage-collection job is needed.

[rclone copy](https://rclone.org/commands/rclone_copy/) skips identical files and does not delete destination files. [rclone check](https://rclone.org/commands/rclone_check/) supplies verification, and the [S3 backend docs](https://rclone.org/s3/) explain checksum behavior. Use Cloudflare's [rclone setup](https://developers.cloudflare.com/r2/examples/rclone/) with S3 provider `Cloudflare`, the account R2 endpoint, and region `auto`.

## CI and deployment

Add `scripts/slackdata/sync.py`, `scripts/slackdata/test_sync.py`, `.github/workflows/sync-slackdata.yml`, and a short `scripts/slackdata/README.md`. The script should separate local validation/build from upload so CI can run without R2 credentials. Use Python's standard library and subprocess calls to rclone rather than a new SDK or workflow framework.

One workflow has separate validation and publishing jobs:

- Pull requests changing the script, fixtures, or workflow run synthetic fixture tests and a local build only. They receive no R2 secrets. Do not use `pull_request_target`.
- Schedule the publisher for `43 5 * * *`, 05:43 UTC, 02:43 in Sao Paulo, after upstream's 03:17 UTC export. Also support `workflow_dispatch` with dry-run enabled by default and an optional upstream SHA for reproducibility. Production publication runs only trusted code from the default branch; an upstream SHA selects data, never publisher code.
- A push to the default branch changing publisher files runs validation and then publication. Use one concurrency group for all publishing events, with `cancel-in-progress: false`, so two runs cannot race the pointer. Pin action commits and an rclone release with a verified download checksum.
- `contents: read` is enough. Check out upstream separately with shallow history and `persist-credentials: false`. Do not install the whole monorepo or execute scripts from the backup.
- Configure `SLACKDATA_R2_ENDPOINT`, `SLACKDATA_R2_BUCKET`, and `SLACKDATA_CDN_BASE_URL` as variables; store `SLACKDATA_R2_ACCESS_KEY_ID` and `SLACKDATA_R2_SECRET_ACCESS_KEY` as secrets. Use a dedicated Object Read & Write credential restricted to the target bucket, not account administration credentials. Do not claim ordinary bucket-scoped credentials enforce a prefix restriction. Enforce the `slackdata/` destination in the script, including dry-run and rollback paths. Configure rclone through environment variables, without writing credentials to committed files or logs.
- Use existing GitHub Actions failure notifications and job summaries. No new alert service is required. `lastSuccessfulCheckAt` older than 48 hours means the mirror needs investigation. A successful no-change run advances it; a failed run does not.

The current remote default branch is **`main`**, while the integration PR targeted `develop`. [GitHub schedules](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule) run only on the default branch, can be delayed or dropped, and public-repo schedules disable after 60 days without repository activity. Deployment is incomplete until the workflow reaches `main`, secrets exist, notifications are enabled, and a real scheduled execution is observed. Treat this as an eventually updated daily mirror, not a real-time recall service. Manual dispatch is the recovery for missed runs; exact daily delivery is not guaranteed by this design.

## Smallest delivery sequence

1. **Prove a photo reaches the CDN.** Implement validation/index generation and the publisher, run a full dry-run, then manually publish the current backup. Verify the Nova thumbnail and immutable index through the existing custom domain before adding automation. Record actual storage and request counts. This proves the real source-to-R2-to-CDN boundary first.
2. **Automate the same command.** Add fixture CI, daily/manual publication, concurrency, credentials, summaries, and the runbook. Exercise a no-change rerun, a new media file, a failed transfer, and a rollback. Promote the workflow through the repository's release path to `main`; do not change the default branch to activate it.
3. **Connect picker photos.** Add an optional asset-index client in `expo/features/webbing/catalog-assets.ts` with tests, and extend `expo/hooks/use-webbing-catalog.ts` or an adjacent explicit-load hook. Fetch the pointer and immutable index in parallel with the existing catalog request when the picker opens, with a five-second total budget for this optional lookup. Keep results in memory for 30 minutes. Failure must not block or reject the hosted catalog. Resolve photos by webbing ID, with a normalized name/brand consistency check against the API record to catch reassigned IDs. Skip mismatches and report them. Use the existing `getR2PublicUrl` helper and `CatalogCardProps.imageUri` in `expo/components/webbing-catalog-picker/catalog-cards.tsx`, updating its obsolete image-source comment. Serve the first `small` photo; do not download large images eagerly. Preserve the current empty-photo appearance and handle image-load errors. Add photo credit beside the existing SlackData attribution using existing translation conventions. Product photos do not replace personal photos or write into physical webbing records.

Step 3 is a small consumer change, not a switch to a self-hosted catalog. The published warning array remains unused by the app in this delivery. A later warning feature must distinguish saved historical details from current warnings and must not interpret a missing or stale warning as proof of safety.

## Verification and recovery

Run `python3 -m unittest discover -s scripts/slackdata -p 'test_*.py'`. Synthetic cases must prove correct ID association for Nova 54 versus Nova Magic 25 265, optional photos, multiple exact warnings, uncertain matches excluded from automatic association, duplicate/invalid IDs rejected, path traversal rejected, and missing referenced media preventing publication. Keep the full backup out of test fixtures.

Document a local `--dry-run --source-dir <checkout>` command and a live-source dry-run. They must produce the release, count/size report, and intended rclone operations without changing R2, including the pointer. A publisher failure test with a stub rclone process must prove the pointer command is never invoked after validation, transfer, or verification failure. A same-input build must produce the same release ID; a publisher output change must produce a different one.

On real R2, publish once, rerun unchanged, and observe zero existing-media transfers and an advanced successful-check timestamp. Change one synthetic media key in an owned test prefix and observe only the addition. Test an inaccessible image through the CDN, a transient upload failure, and an immutable-key conflict. Confirm the public pointer still resolves to the previous valid release on pre-publication failure. Never induce these failures in user-upload prefixes.

For the consumer, run focused asset-client and existing catalog tests with `pnpm --dir expo test -- --runInBand`, selecting the relevant paths, and `pnpm --dir expo exec tsc --noEmit`. Observe both picker layouts on iOS and Android with Nova, Nova Magic 25, a model with no photos, an unavailable CDN, and a mismatched ID/name. Confirm selection and registration still work with assets unavailable and existing catalog badges remain intact. These checks occur during implementation, not this planning task.

Rollback means pausing the publisher, choosing a previously verified immutable release, and replacing only `latest.json`; clients converge within its five-minute TTL and memory-cache window. Keep releases and media so rollback needs no re-upload. Re-enable automation only after fixing the source or publisher, because the next scheduled run would otherwise republish the bad version. Recovery from a partial media upload is simply rerunning the same source revision.

For a removal request, first exclude the referenced asset from the generated index using a small committed denylist, publish that release, then remove the specific object and purge its CDN URL. Apply the exclusion to rollback selection too so an older release cannot restore the removed reference. Retained raw/release files that contain the removed material must be handled as part of that targeted request. Do not turn removal into broad mirror deletion.

## Decisions and verification limits

- **Whole media folder.** Chosen here because 187.4 MB is small and copying one directory is simpler than selective download rules. Revisit if measured growth consumes the available storage allowance or upstream starts including large unrelated archives.
- **GitHub Actions.** Chosen here because the repository is public and a best-effort daily update is sufficient for photos. Revisit only if the product requires guaranteed freshness despite GitHub schedule delays or inactivity disabling.
- **Existing bucket and CDN.** Reuse is supported by the source configuration but the deployed bucket name, available free quota, CDN routing, response headers, and credentials are unverified. Check these before the first upload. If the deployed CDN cannot expose a new prefix, resolve that configuration explicitly rather than introducing a server by default.
- **Photo index alongside the hosted API.** Chosen here to preserve registration's normalized specs/certification and avoid reimplementing upstream joins. Revisit if the user later wants the backup to replace the hosted API entirely.
- **No stored snapshot or warning-refresh changes.** This follows the existing integration contract. Source warning text is available and preserved, but a new safety-notification product is not required to ship photo sync.

Stop and report a material source-contract change if upstream no longer provides ID-owned photo paths, seed IDs cease to correspond to API IDs, existing media keys contain different bytes, or required metadata is absent. Ordinary network failure is retryable and does not require redesign. Missing deployment credentials can leave implementation locally verified, but cannot be reported as a deployed sync.

This planning run read the earlier thread, inspected source and GitHub metadata, measured file sizes, and checked primary documentation. It did not access R2 billing, upload media, create credentials, change CI, run app tests, deploy, or modify the application. Only this plan was added; existing unrelated working-tree changes were preserved.
