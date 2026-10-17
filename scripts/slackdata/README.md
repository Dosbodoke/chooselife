# SlackData backup mirror

`sync.py` copies SlackData's daily backup ([emilebragard/slackdata-data](https://github.com/emilebragard/slackdata-data)) into Choose Life's R2 bucket under `slackdata/`. It publishes an index keyed by webbing ID so the mobile picker can show the right product photo. Emile, the backup's maintainer, invited us to pull its media and data. The plan is [plans/005-slackdata-backup-sync.md](../../plans/005-slackdata-backup-sync.md).

It needs Python 3.9+ (standard library only), git, and rclone. It never executes anything from the backup, writes to the database, or touches saved webbing snapshots.

## What it publishes

```text
slackdata/media/<upstream media key>                 every file in data/media/, immutable
slackdata/releases/<release-id>/index.json           photos + exact-match warnings by webbing ID
slackdata/releases/<release-id>/data/<name>.json     raw data/*.json except changes.json
slackdata/latest.json                                the only mutable object, written last
```

`release-id` is the SHA-256 of the generated index and raw JSON bytes. The same input always gives the same ID. A change to the publisher's output gives a new one.

Media is uploaded once per key with `rclone copy --checksum --immutable`, at `Cache-Control: public,max-age=31536000,immutable`. Each media type gets an explicit Content-Type. SVG files are served as downloads (`Content-Disposition: attachment`) so untrusted markup never renders on our origin. Nothing is ever deleted. If an existing key holds different bytes, the run fails.

`latest.json` uses `Cache-Control: public,max-age=300,must-revalidate`. It is written only after every check below passes:

1. Validate before uploading:
   - required JSON parses
   - IDs are unique positive integers
   - each photo lives under `webbings/<own id>/`
   - paths are safe (no absolute paths, traversal, dot segments or backslashes)
   - no symlinks, no empty or missing referenced media
   - media types are known
2. Copy media, then the release.
3. `rclone check --one-way` the media.
4. Compare exact MD5s of the release files. This also proves R2 exposed MD5s rather than sizes.
5. Fetch the new index and the Nova thumbnail through the CDN, checking bytes and Content-Type.
6. Write `latest.json`, read it back, and require an exact match.

A run whose source commit is older than the live one is refused unless you pass `--allow-older-source`.

Warnings: only `confidence: exact` webbing matches are attached to models in the index. Likely, ambiguous, partial and unmatched warnings are counted in `warningMatches` and kept whole in `data/isa_gear_warnings.json`. The app doesn't use warnings yet.

Attribution: catalog data is CC BY-SA 4.0, by the International Slackline Association via SlackData. Photos belong to their respective owners via SlackData/ISA and are **not** CC BY-SA. The index records both.

## Run it

Tests use synthetic fixtures only:

```sh
python3 -m unittest discover -s scripts/slackdata -p 'test_*.py'
```

Local build or dry-run. These need no credentials and never run rclone:

```sh
# an existing clean checkout
git clone --depth 1 https://github.com/emilebragard/slackdata-data /tmp/slackdata-src
python3 scripts/slackdata/sync.py --source-dir /tmp/slackdata-src --dry-run --out /tmp/slackdata-out

# or let the script make a shallow clone; pin a revision for reproducibility
python3 scripts/slackdata/sync.py --source-git --dry-run
python3 scripts/slackdata/sync.py --source-git --source-ref <40-char sha> --dry-run
```

- Without a mode flag, the script builds and validates the release in `--out` (or a temp dir) and prints a JSON summary.
- `--dry-run` also prints every rclone command it would run.
- `--previous-index <index.json>` adds the record/warning diff that `--publish` computes from the live release.

Publish (operators only):

```sh
export SLACKDATA_R2_BUCKET=<physical bucket>          # required; verify the deployed name
export SLACKDATA_CDN_BASE_URL=https://cdn.chooselife.club  # default

# either a dedicated, bucket-scoped Object Read & Write token:
export SLACKDATA_R2_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
export SLACKDATA_R2_ACCESS_KEY_ID=...
export SLACKDATA_R2_SECRET_ACCESS_KEY=...
python3 scripts/slackdata/sync.py --source-git --publish

# or an rclone remote already configured with provider Cloudflare, region auto:
python3 scripts/slackdata/sync.py --source-git --publish --rclone-remote <remote>
```

- Env credentials reach rclone as `RCLONE_CONFIG_SLACKDATAR2_*` variables, never through argv or logs.
- Bucket credentials can't enforce a prefix. The script builds every destination through a single function that refuses anything outside `slackdata/`.
- A lock file (`~/.cache/chooselife-slackdata/publish.lock`, or `--lock-file`) stops two local publishes from racing the pointer. It only covers one machine, so don't publish from two places at once.
- rclone gets `--retries=3 --contimeout=60s` and the whole publish has a 30-minute budget. Uploads set `--s3-storage-class=STANDARD`, the class R2's free allowance covers.
- `--fast-list` reads the prefix in pages of up to 1,000 objects instead of listing every folder separately. Together with `--checksum`, this reduces repeat-run requests without weakening verification. R2 storage and requests still share account-wide allowances; local execution does not guarantee a zero R2 bill.
- Public URLs have no bucket segment: `https://cdn.chooselife.club/slackdata/...`. The CDN check sends `User-Agent: ChooseLife-SlackDataSync/1.0`, because Cloudflare rejects Python's default agent.
- The script exits 1 on failure. A failure before the pointer write prints `latest.json was not changed by this run`. If the outcome of the pointer write itself is unknown, it says so: read `slackdata/latest.json` before retrying. Rerunning the same source is always safe.
- The summary (stdout and `<out>/summary.json`) reports the source SHA and version, counts, bytes, per-pass transfers/checks, uncertain-warning counts, record changes and the published release ID.

`lastSuccessfulCheckAt` in `latest.json` advances on every successful run, including no-change runs. If it's more than 48 hours old, the mirror needs a look.

## Optional local schedule (macOS launchd)

Nothing schedules this automatically. A GitHub Actions workflow is on hold until its cost is cleared. To run it daily from a Mac, save the file below as `~/Library/LaunchAgents/club.chooselife.slackdata-sync.plist`. Use absolute paths, because launchd has a minimal `PATH`. Use an rclone remote so the plist holds no secrets.

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>club.chooselife.slackdata-sync</string>
  <key>ProgramArguments</key>
  <array>
    <string>/opt/homebrew/bin/python3</string>
    <string>/ABSOLUTE/PATH/chooselife/scripts/slackdata/sync.py</string>
    <string>--source-git</string>
    <string>--publish</string>
    <string>--rclone-remote</string><string>REMOTE</string>
    <string>--rclone</string><string>/opt/homebrew/bin/rclone</string>
    <string>--out</string><string>/tmp/slackdata-sync</string>
  </array>
  <key>EnvironmentVariables</key>
  <dict>
    <key>SLACKDATA_R2_BUCKET</key><string>BUCKET</string>
    <key>PATH</key><string>/usr/bin:/bin:/opt/homebrew/bin</string>
  </dict>
  <!-- Local time; upstream exports at 03:17 UTC. 02:43 in Sao Paulo = 05:43 UTC. -->
  <key>StartCalendarInterval</key>
  <dict><key>Hour</key><integer>2</integer><key>Minute</key><integer>43</integer></dict>
  <key>StandardOutPath</key><string>/tmp/slackdata-sync.log</string>
  <key>StandardErrorPath</key><string>/tmp/slackdata-sync.log</string>
</dict>
</plist>
```

Load it with `launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/club.chooselife.slackdata-sync.plist`. Remove it with `launchctl bootout gui/$(id -u)/club.chooselife.slackdata-sync`. If the Mac was asleep at the scheduled time, launchd runs the job once on wake. If it was off, the run is skipped. Watch `lastSuccessfulCheckAt`.

## Rollback

1. Pause any schedule.
2. Choose a previously verified release ID.
3. Replace only `latest.json` with that release's pointer fields (`rclone copyto` with the pointer Cache-Control header).

Clients converge within the five-minute TTL plus their 30-minute memory cache. Releases and media are never deleted, so a rollback needs no re-upload. Fix the source or publisher before re-enabling the schedule, or the next run republishes. The script refuses to go back to older source data unless you pass `--allow-older-source`.

## Removal requests

1. Add the media key to `denylist.txt`. Listed keys are dropped from the index and excluded from every upload pass, so a new release is created without them.
2. Publish.
3. Delete that one object (`slackdata/media/<key>`) and purge its CDN URL.
4. Don't roll back to a release that predates the denylist entry.

Raw release JSON that still names the file is handled as part of that specific request. Never delete the mirror wholesale.
