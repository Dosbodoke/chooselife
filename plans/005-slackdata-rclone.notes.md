# SlackData local rclone preparation

Checked October 17, 2026. This note contains no credentials or user object names. Preparation was read-only. Root subsequently reviewed and authorized local publication, and the mirror is now live and verified. No deletions, infrastructure changes, CI, or scheduled jobs were performed.

## Local readiness

- Existing executable `/opt/homebrew/bin/rclone` is v1.73.2 on macOS arm64. No installation was needed.
- Existing remote `r2:` uses S3 provider Cloudflare, region `auto`, and has both credential fields. Its endpoint and credential values match the project's `next/.env` in memory. Values were not printed or copied.
- Project configuration selects physical bucket `chooselife` and public base `https://cdn.chooselife.club`.
- Neither project file has the new `SLACKDATA_*` variable names yet. The publisher can receive mapped existing values through its process environment. Do not source an environment file as shell code.
- Read and write access are now verified by the successful publication. The token's exact administrative scope was not inspected. Ordinary bucket-scoped credentials do not enforce a prefix. Every destination remained under `chooselife/slackdata/`.
- Existing remote did not set `disable_checksum`. A private `rclone lsjson --hash` inspection found MD5 hashes for all 171 existing target objects. No object names or contents were printed.

## Pinned upstream

The task-owned shallow checkout is `/var/folders/4d/px4017t53z7dx66qvy4fcvx00000gn/T/chooselife-slackdata-rclone-zoh4jrp6/source`. It is outside the repository and can be removed after the work. Upstream code was never executed.

- Commit `d7cd9ab33e40689c78c628a938c4847a42aefd53`, committed `2026-10-16T23:34:05Z`.
- `data/catalogue.json` version 1.
- 2,679 media objects, 187,389,018 bytes.
- 13 raw JSON files excluding `changes.json`, 1,337,551 bytes.
- Combined source payload 188,726,569 bytes, before the generated index and pointer.
- Formats are 2,534 WebP, 74 PDF, 64 JPEG, 5 PNG, and 2 SVG.
- Largest media object is 10,593,424 bytes. A 200 MiB upload cutoff keeps every current object single-part.
- 259 webbings, 251 with photos, and no symlinks anywhere in the checkout.
- Nova 54 and Nova Magic 25 265 have separate photo paths under their IDs.

## Read-only R2 and CDN evidence

The following commands succeeded. Object listings were captured in memory and reduced to counts or hash availability before output.

```sh
rclone version
rclone listremotes
rclone size r2:chooselife --json --s3-no-check-bucket --retries 1 --low-level-retries 1 --contimeout 20s --timeout 30s
rclone lsjson r2:chooselife/slackdata --recursive --files-only --s3-no-check-bucket --retries 1 --low-level-retries 1
rclone lsjson r2:chooselife --recursive --files-only --hash --s3-no-check-bucket --retries 1 --low-level-retries 1
```

- Before publication, the target bucket had 171 objects and 143,642,579 bytes. The `slackdata/` prefix had zero objects.
- S3 bucket enumeration and size-only reads succeeded for all four accessible buckets. They total 231 objects and 232,367,182 bytes. Other bucket names remain private.
- These are current accessible object totals. They do not establish historical GB-month usage, month-to-date operations, inaccessible or jurisdiction-specific storage, or invoice totals.
- Browser-user-agent HEAD of a privately selected existing object returned 200 at `https://cdn.chooselife.club/<object-key>`, JPEG content type and an MD5-style ETag. Adding the physical bucket name to that public URL returned 404. Public URLs must not add `/chooselife/`.
- Python's default urllib user agent received Cloudflare 403. `Mozilla/5.0` returned 200 for the same existing key, and 404 for the unpublished `/slackdata/latest.json`. Both honest explicit agents `ChooseLife-SlackDataSync/1.0` and `rclone/v1.73.2` also returned 200 for that key. This is a client-header behavior, not evidence that the CDN is disconnected. Publisher verification should use `ChooseLife-SlackDataSync/1.0`.
- The sampled existing object had `cf-cache-status: DYNAMIC`. This does not establish caching rules for newly uploaded immutable objects.
- A redundant `lsjson` probe without `--hash` timed out at 40 seconds while retrieving default file metadata. Use `lsf --recursive --files-only` for private key selection; it avoids unnecessary metadata retrieval. No timeout caused a write.

## Cost evidence and limits

[Cloudflare R2 pricing](https://developers.cloudflare.com/r2/pricing/), checked October 17, 2026, gives Standard a monthly free allowance of 10 GB-month, one million Class A operations and ten million Class B operations. Paid rates are $0.015 per GB-month, $4.50 per million Class A and $0.36 per million Class B. Internet egress is free. Billing rounds account usage up to billing units. Infrequent Access does not receive these free allowances, so the publisher must explicitly use Standard.

The new source payload is 0.18873 GB. The observed accessible current storage plus that payload is 0.42110 GB, before the generated index. This is far below 10 GB as a current-storage comparison. It is not proof that this month's account allowances are unused.

The first successful publication transferred 2,679 media objects, 14 immutable JSON objects including the generated index, and one pointer, 2,694 object writes. Each successful unchanged rerun wrote only the pointer. Transfer statistics count files and checks, not billable API requests. Checksum comparisons can use ETags from listings, while successful uploads receive a verification HEAD. Actual HTTP request totals were not instrumented. App image traffic is additional.

The final publisher uses `--fast-list`. [rclone's S3 cost guidance](https://rclone.org/s3/#reducing-costs) says ordinary traversal lists each directory, while recursive fast listing needs a page per 1,000 objects. The local media tree has 766 directories and 2,679 objects. The five type passes and the media verification can therefore use roughly 18 whole-media listing pages in total, plus small release listings, instead of repeating directory traversal. This is a documentation-based estimate, not a measured Cloudflare billing count. It uses a few MB of listing memory and preserves checksum, immutable, and post-upload integrity checks. The original run without this flag was slower and cannot justify a small listing-request estimate.

Available S3 credentials do not expose monthly billing metrics. Existing Wrangler OAuth configuration has no R2 or analytics scopes. No new token was created, and no account administration action was attempted. Month-to-date operation usage and remaining free allowance are unverified. Consequently, this preparation cannot promise an unconditional $0 R2 invoice. Local execution adds no paid runner service.

Relevant references are [Cloudflare rclone setup](https://developers.cloudflare.com/r2/examples/rclone/), [R2 token permissions](https://developers.cloudflare.com/r2/api/tokens/), and [rclone S3 hash behavior](https://rclone.org/s3/#modification-times-and-hashes).

## Actual local publication

All runs used the clean pinned checkout above, existing remote `r2`, `SLACKDATA_R2_BUCKET=chooselife`, `SLACKDATA_CDN_BASE_URL=https://cdn.chooselife.club`, and `/opt/homebrew/bin/rclone`. Every dry-run remote argument was inspected and began with `r2:chooselife/slackdata/`.

The exact reusable command shape was:

```sh
SLACKDATA_R2_BUCKET=chooselife SLACKDATA_CDN_BASE_URL=https://cdn.chooselife.club \
  python3 scripts/slackdata/sync.py \
  --source-dir /var/folders/4d/px4017t53z7dx66qvy4fcvx00000gn/T/chooselife-slackdata-rclone-zoh4jrp6/source \
  --publish --rclone-remote r2 --rclone /opt/homebrew/bin/rclone \
  --out <fresh-task-owned-output-directory>
```

Output directories were `publish-1-retry`, `publish-2-unchanged`, and `publish-3-fast-list` under the task-owned temporary directory. Each has its `summary.json` and built release. The surrounding directory also holds captured stdout, stderr, CDN verification, isolated-test results, and final verification. No credentials were printed or copied into them.

| Run | Exit | Seconds | Immutable transfers | Immutable bytes | Heartbeat UTC |
| --- | ---: | ---: | ---: | ---: | --- |
| First successful publication | 0 | 652.37 | 2,693 | 188,814,386 | 18:55:42 |
| Unchanged rerun | 0 | 135.96 | 0 | 0 | 18:58:10 |
| Final unchanged rerun with `--fast-list` | 0 | 32.38 | 0 | 0 | 18:59:09 |

The first transfer counts were WebP 2,534 / 103,325,414 bytes, JPEG 64 / 2,282,175 bytes, PNG 5 / 102,513 bytes, SVG 2 / 64,794 bytes, PDF 74 / 81,614,122 bytes, and release JSON 14 / 1,425,368 bytes. All passes reported zero errors. Both unchanged runs checked 2,693 existing files in their copy passes, transferred zero files and bytes in every media/release pass, and reported no added, removed, renamed, photo-changed, or warning-changed entries. Each then performed full media verification, exact release MD5 verification, CDN checks, a pointer write, and exact S3 read-back.

All runs published the same release `4b9c6bfd3881175023d9c1d988620d25101690a810fe379c681b2455115e7998`. Adding `--fast-list` preserved its digest and reduced the unchanged run from 135.96 to 32.38 seconds, about 76%. Final `sync.py` SHA-256 was `ce23d3dfd233e5598f9923aa3f43622cda7e0aa49ce925ae3352e922187fe4f8`.

Independent final checks read the pointer from S3 and the CDN and matched both byte for byte to the local 374-byte pointer. Its successful-check time is `2026-10-17T18:59:09Z`. The final `slackdata/` size is 2,696 objects and 188,814,795 bytes. Of these, 2,694 production objects occupy 188,814,760 bytes, and the isolated tests below retain two tiny objects totaling 35 bytes.

## Public CDN verification

- [The live pointer](https://cdn.chooselife.club/slackdata/latest.json) returned 200, `application/json`, `Cache-Control: public,max-age=300,must-revalidate`, and `cf-cache-status: DYNAMIC`.
- The immutable index returned 200 and exactly matched the local 87,817-byte index. Its type is `application/json` and cache header is `public,max-age=31536000,immutable`. JSON was `DYNAMIC`, so no automatic edge caching is claimed.
- [Nova 54's thumbnail](https://cdn.chooselife.club/slackdata/media/webbings/54/5ef8465af089d95b-480.webp) returned 200, `image/webp`, 22,412 bytes, an immutable one-year cache header, and `cf-cache-status: HIT`.
- [Nova Magic 25 265's thumbnail](https://cdn.chooselife.club/slackdata/media/webbings/265/6b6d604f26f8c624-480.webp) returned the same successful type/cache status but different source-matching bytes, 2,400 bytes. The photo keys and SHA-256 hashes differ.
- Representative JPEG, PNG, SVG, and PDF HEADs returned 200 with the correct explicit MIME type and immutable one-year cache header. SVG also returned `Content-Disposition: attachment`.
- Every public URL omitted the physical bucket segment. The root agent separately ran the actual TypeScript asset client with Node's default fetch against the CDN, loaded all 259 models, and confirmed both distinct photos.

## Isolated real-R2 checks

Tests stayed within `slackdata/operator-tests/20261017-bf3c0d205c21/`. They never changed production media, releases, or the live pointer.

- Initial copy transferred one 17-byte file.
- Addition transferred only the new 18-byte file and checked the existing one.
- Unchanged copy checked both files and transferred zero bytes.
- Changing the first file locally to different bytes of the same size produced an immutable conflict, exit 6, with zero transfers. Exact remote MD5s still matched the original payloads.
- The production pointer was byte-identical before and after the test sequence.
- An intentionally absent CDN image in the isolated namespace returned 404.
- Both tiny objects remain, 35 bytes total. Nothing was deleted.

A true transient upload failure and production rollback were not induced on R2. The publisher's stub-test evidence covers failure ordering and lost pointer responses. Native iOS/Android picker rendering and an app release remain outside this operator's verification.

## Deviations

The root agent selected local-only operation after the user's cost instruction. No GitHub publishing workflow or background schedule was enabled. The selected raw JSON payload is 1,337,551 bytes because `changes.json` is excluded; the earlier plan's 1,338,140-byte figure included every JSON file. Runtime evidence also led root to add explicit cutoff units and `--fast-list`; the operator did not edit publisher code.

## How the run ended

The deployed mirror is verified. First publication, an unchanged rerun, and the final optimized unchanged rerun all passed. Source and release digests stayed the same; existing media and release bytes were not re-uploaded. Pointer heartbeat advancement, S3/CDN consistency, content types, caching headers, distinct Nova photos, additive uploads, and immutable conflict handling were observed on the real service.

The first attempted run had failed after 1.46 seconds, before writes, because an unsuffixed cutoff was interpreted as 200 GiB. Root corrected it to `209715200B` and added regression coverage before authorizing the successful retry. The operator changed only this tracked notes file and task-owned local setup files.

No CI, local background schedule, infrastructure changes, deletions, commit, push, or mobile deployment occurred. Monthly account quota remains unverified. After this operator finished, the parent verified the iOS tile picker after the user signed in, including distinct Nova/Nova Magic 25 images, photo credit, Recall badge, and correct Nova selection without submitting registration. Other native cases remain pending; see the execution notes. The live mirror is available to the implemented mobile consumer when that app code is released.
