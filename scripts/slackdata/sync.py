#!/usr/bin/env python3
"""Mirror SlackData's daily backup (media + catalog JSON) into Choose Life's R2.

Reads one pinned git checkout of https://github.com/emilebragard/slackdata-data,
validates it, builds a deterministic release locally and, only with --publish,
copies it to R2 with rclone. See README.md in this directory.

Standard library only. Nothing from the backup is ever executed.
"""

from __future__ import annotations

import argparse
import contextlib
import datetime as dt
import fcntl
import hashlib
import json
import os
import re
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.request
from dataclasses import dataclass, field
from pathlib import Path
from typing import Callable

INDEX_SCHEMA_VERSION = 1
POINTER_SCHEMA_VERSION = 1
UPSTREAM_REPOSITORY = "https://github.com/emilebragard/slackdata-data"
DEFAULT_CDN_BASE_URL = "https://cdn.chooselife.club"
NAMESPACE = "slackdata"
ENV_REMOTE_NAME = "slackdatar2"
DENYLIST_PATH = Path(__file__).with_name("denylist.txt")

# Upstream excludes: the contributor log never goes on the CDN.
EXCLUDED_DATA_FILES = {"changes.json"}
REQUIRED_DATA_FILES = ("webbings.json", "isa_gear_warnings.json", "catalogue.json")

# rclone infers Content-Type from the extension; anything else fails validation
# so an unexpected file type is never served with a guessed type.
MEDIA_TYPES = {
    ".webp": "image/webp",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".svg": "image/svg+xml",
    ".pdf": "application/pdf",
}
# Every file must stay single-part so R2's ETag is the MD5 rclone compares.
UPLOAD_CUTOFF_BYTES = 200 * 1024 * 1024
MAX_MEDIA_BYTES = 100 * 1024 * 1024

IMMUTABLE_CACHE = "Cache-Control: public,max-age=31536000,immutable"
POINTER_CACHE = "Cache-Control: public,max-age=300,must-revalidate"
PUBLISH_BUDGET_SECONDS = 30 * 60

SAFE_KEY = re.compile(r"^[A-Za-z0-9_-][A-Za-z0-9._-]*(/[A-Za-z0-9_-][A-Za-z0-9._-]*)*$")
SAFE_DATA_NAME = re.compile(r"^[a-z0-9_]+\.json$")
SAFE_BUCKET = re.compile(r"^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$")
SAFE_REMOTE = re.compile(r"^[A-Za-z0-9_-]+$")
RELEASE_ID = re.compile(r"^[0-9a-f]{64}$")
SHA = re.compile(r"^[0-9a-f]{40}$")
HTTP_URL = re.compile(r"^https?://\S+$")


class SyncError(Exception):
    """Validation or publication failure.

    Raised before the pointer write, it leaves the live release untouched;
    `pointer_unknown` marks the rare failure during or after that write.
    """

    pointer_unknown = False


# ============================================================================
# Source
# ============================================================================


@dataclass
class Source:
    root: Path
    commit: str
    committed_at: str


def git(root: Path, *args: str) -> str:
    result = subprocess.run(
        ["git", "-C", str(root), *args],
        capture_output=True,
        text=True,
        check=False,
    )
    if result.returncode != 0:
        raise SyncError(f"git {' '.join(args)} failed: {result.stderr.strip()}")
    return result.stdout


def read_source(root: Path) -> Source:
    """A clean checkout: the recorded SHA must describe exactly these bytes."""
    root = root.resolve()
    if not (root / "data").is_dir():
        raise SyncError(f"{root} has no data/ directory")
    commit, committed_at = git(root, "log", "-1", "--format=%H%n%cI").split()
    if not SHA.match(commit):
        raise SyncError(f"Unexpected commit id {commit!r}")
    dirty = git(root, "status", "--porcelain", "--untracked-files=all", "--", "data")
    if dirty.strip():
        raise SyncError("Source checkout has local changes under data/; use a clean checkout")
    return Source(root=root, commit=commit, committed_at=to_utc(committed_at))


@contextlib.contextmanager
def clone_source(url: str, ref: str | None):
    """Shallow, credential-free checkout of one upstream revision."""
    with tempfile.TemporaryDirectory(prefix="slackdata-src-") as tmp:
        root = Path(tmp) / "checkout"
        if ref:
            if not SHA.match(ref):
                raise SyncError("--source-ref must be a full 40-character commit SHA")
            root.mkdir()
            git(root, "init", "--quiet")
            git(root, "fetch", "--quiet", "--depth=1", "--no-tags", url, ref)
            git(root, "-c", "advice.detachedHead=false", "checkout", "--quiet", "FETCH_HEAD")
        else:
            result = subprocess.run(
                ["git", "clone", "--quiet", "--depth=1", "--no-tags", url, str(root)],
                capture_output=True,
                text=True,
                check=False,
            )
            if result.returncode != 0:
                raise SyncError(f"git clone failed: {result.stderr.strip()}")
        yield root


def to_utc(value: str) -> str:
    return (
        dt.datetime.fromisoformat(value.replace("Z", "+00:00"))
        .astimezone(dt.timezone.utc)
        .strftime("%Y-%m-%dT%H:%M:%SZ")
    )


# ============================================================================
# Validation and index
# ============================================================================


@dataclass
class Release:
    release_id: str
    index: dict
    index_bytes: bytes
    data_files: dict[str, bytes]
    media_root: Path
    media_files: int
    media_bytes: int
    excluded_media: list[str]
    report: dict = field(default_factory=dict)

    @property
    def index_path(self) -> str:
        return f"{NAMESPACE}/releases/{self.release_id}/index.json"


def is_safe_key(key: object) -> bool:
    return isinstance(key, str) and len(key) <= 512 and bool(SAFE_KEY.match(key))


def load_json(path: Path, label: str):
    if path.is_symlink() or not path.is_file():
        raise SyncError(f"{label} is missing or not a regular file")
    try:
        return json.loads(path.read_bytes())
    except (ValueError, UnicodeDecodeError) as error:
        raise SyncError(f"{label} is not valid JSON: {error}") from None


def scan_media(media_root: Path) -> dict[str, int]:
    """Every file under data/media/ by key, rejecting symlinks and unsafe names."""
    if media_root.is_symlink() or not media_root.is_dir():
        raise SyncError("data/media is missing or not a directory")
    files: dict[str, int] = {}
    for directory, dirnames, filenames in os.walk(media_root):
        base = Path(directory)
        for name in dirnames + filenames:
            path = base / name
            key = path.relative_to(media_root).as_posix()
            if path.is_symlink():
                raise SyncError(f"Symlink in media: {key}")
            if not is_safe_key(key):
                raise SyncError(f"Unsafe media path: {key!r}")
        for name in filenames:
            path = base / name
            key = path.relative_to(media_root).as_posix()
            if not path.is_file():
                raise SyncError(f"Not a regular file: {key}")
            if path.suffix.lower() not in MEDIA_TYPES:
                raise SyncError(f"Unsupported media type: {key}")
            size = path.stat().st_size
            if size > MAX_MEDIA_BYTES:
                raise SyncError(f"Media file too large for single-part upload: {key}")
            files[key] = size
    return files


def read_denylist(path: Path) -> set[str]:
    if not path.exists():
        return set()
    keys = set()
    for line in path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        if not is_safe_key(line):
            raise SyncError(f"Unsafe denylist entry: {line!r}")
        keys.add(line)
    return keys


def validate_webbings(raw, media: dict[str, int], denied: set[str]) -> dict[int, dict]:
    if not isinstance(raw, list) or not raw:
        raise SyncError("data/webbings.json must be a nonempty array")
    by_id: dict[int, dict] = {}
    for position, record in enumerate(raw):
        where = f"webbings.json[{position}]"
        if not isinstance(record, dict):
            raise SyncError(f"{where} is not an object")
        webbing_id = record.get("id")
        if type(webbing_id) is not int or webbing_id <= 0:
            raise SyncError(f"{where} has an invalid id")
        if webbing_id in by_id:
            raise SyncError(f"Duplicate webbing id {webbing_id}")
        name = record.get("name")
        if not isinstance(name, str) or not name.strip():
            raise SyncError(f"Webbing {webbing_id} has no name")
        brand = record.get("brand")
        if brand is not None and not isinstance(brand, str):
            raise SyncError(f"Webbing {webbing_id} has an invalid brand")

        photos_raw = record.get("photos")
        if photos_raw is None:
            photos_raw = []
        if not isinstance(photos_raw, list):
            raise SyncError(f"Webbing {webbing_id} photos must be an array")
        photos = []
        owner_prefix = f"webbings/{webbing_id}/"
        for photo in photos_raw:
            if not isinstance(photo, dict) or not isinstance(photo.get("id"), str):
                raise SyncError(f"Webbing {webbing_id} has a malformed photo")
            entry = {"id": photo["id"]}
            for size in ("small", "large"):
                key = photo.get(size)
                if not is_safe_key(key):
                    raise SyncError(f"Webbing {webbing_id} photo has unsafe {size} path {key!r}")
                if not key.startswith(owner_prefix):
                    raise SyncError(f"Webbing {webbing_id} photo {key} belongs to another record")
                if key not in media:
                    raise SyncError(f"Webbing {webbing_id} references missing media {key}")
                if media[key] == 0:
                    raise SyncError(f"Webbing {webbing_id} references empty media {key}")
                entry[size] = key
            if entry["small"] in denied or entry["large"] in denied:
                continue
            photos.append(entry)
        by_id[webbing_id] = {
            "id": webbing_id,
            "name": name,
            "brand": brand,
            "photos": photos,
        }
    return by_id


def warning_descriptor(item: dict) -> dict:
    """Plain-text warning fields, verbatim. Remote images are never carried."""
    descriptor = {
        key: item[key]
        for key in ("id", "status", "date", "model", "manufacturer", "description", "solution")
        if isinstance(item.get(key), str)
    }
    descriptor["links"] = [
        item[key]
        for key in sorted(k for k in item if re.fullmatch(r"link\d+", k))
        if isinstance(item[key], str) and HTTP_URL.match(item[key])
    ]
    match = item["match"]
    descriptor["match"] = {
        "gearType": match["gearType"],
        "gearIds": match["gearIds"],
        "confidence": match["confidence"],
    }
    if isinstance(match.get("note"), str):
        descriptor["match"]["note"] = match["note"]
    return descriptor


def associate_warnings(raw, by_id: dict[int, dict]) -> dict:
    """Attach only exact webbing matches by ID; everything else is counted."""
    if not isinstance(raw, dict) or not isinstance(raw.get("items"), list):
        raise SyncError("data/isa_gear_warnings.json must be an object with an items array")
    counts = {"exact": 0, "likely": 0, "ambiguous": 0, "partial": 0, "none": 0, "malformed": 0}
    webbing = {"attached": 0, "skippedUncertain": 0, "exactUnknownId": 0}
    for entry in by_id.values():
        entry["warnings"] = []
    for item in raw["items"]:
        match = item.get("match") if isinstance(item, dict) else None
        ids = match.get("gearIds") if isinstance(match, dict) else None
        confidence = match.get("confidence") if isinstance(match, dict) else None
        if (
            not isinstance(ids, list)
            or not all(type(i) is int for i in ids)
            or confidence not in counts
        ):
            counts["malformed"] += 1
            continue
        counts[confidence] += 1
        if match.get("gearType") != "webbing":
            continue
        if confidence != "exact":
            webbing["skippedUncertain"] += 1
            continue
        descriptor = warning_descriptor(item)
        for gear_id in dict.fromkeys(ids):
            if gear_id in by_id:
                by_id[gear_id]["warnings"].append(descriptor)
                webbing["attached"] += 1
            else:
                webbing["exactUnknownId"] += 1
    return {"byConfidence": counts, "webbing": webbing}


def canonical(value) -> bytes:
    return (json.dumps(value, sort_keys=True, ensure_ascii=False, separators=(",", ":")) + "\n").encode()


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def build_release(source: Source, denylist: Path = DENYLIST_PATH) -> Release:
    data_dir = source.root / "data"
    if data_dir.is_symlink():
        raise SyncError("data/ must not be a symlink")
    media_root = data_dir / "media"
    media = scan_media(media_root)
    denied = read_denylist(denylist)

    catalogue = load_json(data_dir / "catalogue.json", "data/catalogue.json")
    version = catalogue.get("version") if isinstance(catalogue, dict) else None
    if type(version) is not int:
        raise SyncError("data/catalogue.json has no integer version")
    by_id = validate_webbings(load_json(data_dir / "webbings.json", "data/webbings.json"), media, denied)
    warnings = associate_warnings(
        load_json(data_dir / "isa_gear_warnings.json", "data/isa_gear_warnings.json"), by_id
    )

    data_files: dict[str, bytes] = {}
    for path in sorted(data_dir.glob("*.json")):
        if path.name in EXCLUDED_DATA_FILES:
            continue
        if not SAFE_DATA_NAME.match(path.name):
            raise SyncError(f"Unexpected data file name {path.name!r}")
        load_json(path, f"data/{path.name}")
        data_files[path.name] = path.read_bytes()
    missing = [name for name in REQUIRED_DATA_FILES if name not in data_files]
    if missing:
        raise SyncError(f"Missing required data files: {missing}")

    index = {
        "schemaVersion": INDEX_SCHEMA_VERSION,
        "source": {
            "name": "SlackData",
            "repository": UPSTREAM_REPOSITORY,
            "commit": source.commit,
            "committedAt": source.committed_at,
            "catalogueVersion": version,
            "site": "https://slackdata.org",
        },
        "attribution": {
            "data": {
                "text": "Gear data from SlackData by the International Slackline Association",
                "license": "CC BY-SA 4.0",
                "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0/",
            },
            "media": {
                "text": "Product photos belong to their respective owners, via SlackData/ISA. "
                "They are not covered by the data license.",
            },
        },
        # Photo paths are upstream media keys under <CDN>/slackdata/media/.
        "mediaPrefix": f"{NAMESPACE}/media/",
        "warningMatches": warnings,
        "webbingsById": {str(k): v for k, v in sorted(by_id.items())},
    }
    index_bytes = canonical(index)
    digest_input = canonical(
        {
            "index.json": sha256(index_bytes),
            "data": {name: sha256(body) for name, body in data_files.items()},
            "excludedMedia": sorted(denied & media.keys()),
        }
    )
    published_media = {k: v for k, v in media.items() if k not in denied}
    return Release(
        release_id=sha256(digest_input),
        index=index,
        index_bytes=index_bytes,
        data_files=data_files,
        media_root=media_root,
        media_files=len(published_media),
        media_bytes=sum(published_media.values()),
        excluded_media=sorted(denied & media.keys()),
        report={
            "webbings": len(by_id),
            "webbingsWithPhotos": sum(1 for v in by_id.values() if v["photos"]),
            "webbingsWithWarnings": sum(1 for v in by_id.values() if v["warnings"]),
            "warningMatches": warnings,
        },
    )


def write_release(release: Release, out_dir: Path) -> Path:
    """Local copy of the immutable release tree, mirroring the R2 layout."""
    release_dir = out_dir / NAMESPACE / "releases" / release.release_id
    (release_dir / "data").mkdir(parents=True, exist_ok=True)
    (release_dir / "index.json").write_bytes(release.index_bytes)
    for name, body in release.data_files.items():
        (release_dir / "data" / name).write_bytes(body)
    return release_dir


def diff_indexes(previous: dict | None, current: dict) -> dict:
    """Record and exact-warning association changes since the live release."""
    if not previous:
        return {"previous": None}
    old = previous.get("webbingsById") or {}
    new = current["webbingsById"]

    def warning_ids(entry):
        return sorted(str(w.get("id")) for w in entry.get("warnings", []) if isinstance(w, dict))

    common = old.keys() & new.keys()
    return {
        "previous": (previous.get("source") or {}).get("commit"),
        "added": sorted(int(k) for k in new.keys() - old.keys()),
        "removed": sorted(int(k) for k in old.keys() - new.keys()),
        "renamed": sorted(
            int(k)
            for k in common
            if (old[k].get("name"), old[k].get("brand")) != (new[k]["name"], new[k]["brand"])
        ),
        "photosChanged": sorted(int(k) for k in common if old[k].get("photos") != new[k]["photos"]),
        "warningsChanged": sorted(
            int(k) for k in common if warning_ids(old[k]) != warning_ids(new[k])
        ),
    }


# ============================================================================
# Publication
# ============================================================================


@dataclass
class Target:
    remote: str
    bucket: str
    cdn_base_url: str
    env: dict[str, str]

    def path(self, key: str) -> str:
        """The only way to build a destination: always inside slackdata/."""
        if not (key == NAMESPACE or key.startswith(f"{NAMESPACE}/")):
            raise SyncError(f"Refusing to write outside {NAMESPACE}/: {key}")
        if not is_safe_key(key):
            raise SyncError(f"Unsafe destination key {key!r}")
        return f"{self.remote}:{self.bucket}/{key}"


def resolve_target(remote: str | None, environ: dict[str, str]) -> Target:
    bucket = environ.get("SLACKDATA_R2_BUCKET", "")
    if not SAFE_BUCKET.match(bucket):
        raise SyncError("SLACKDATA_R2_BUCKET must be set to the physical bucket name")
    cdn = environ.get("SLACKDATA_CDN_BASE_URL", DEFAULT_CDN_BASE_URL).rstrip("/")
    if not re.fullmatch(r"https://[a-z0-9.-]+", cdn):
        raise SyncError("SLACKDATA_CDN_BASE_URL must be an https origin without a path")
    env = dict(environ)
    if remote:
        if not SAFE_REMOTE.match(remote):
            raise SyncError("--rclone-remote must be a plain remote name")
        return Target(remote=remote, bucket=bucket, cdn_base_url=cdn, env=env)

    needed = ["SLACKDATA_R2_ENDPOINT", "SLACKDATA_R2_ACCESS_KEY_ID", "SLACKDATA_R2_SECRET_ACCESS_KEY"]
    missing = [name for name in needed if not environ.get(name)]
    if missing:
        raise SyncError(f"Missing {', '.join(missing)} (or pass --rclone-remote)")
    # Credentials reach rclone through its environment only, never argv or logs.
    prefix = f"RCLONE_CONFIG_{ENV_REMOTE_NAME.upper()}_"
    env.update(
        {
            prefix + "TYPE": "s3",
            prefix + "PROVIDER": "Cloudflare",
            prefix + "REGION": "auto",
            prefix + "ENDPOINT": environ["SLACKDATA_R2_ENDPOINT"],
            prefix + "ACCESS_KEY_ID": environ["SLACKDATA_R2_ACCESS_KEY_ID"],
            prefix + "SECRET_ACCESS_KEY": environ["SLACKDATA_R2_SECRET_ACCESS_KEY"],
        }
    )
    return Target(remote=ENV_REMOTE_NAME, bucket=bucket, cdn_base_url=cdn, env=env)


COMMON_FLAGS = [
    "--s3-no-check-bucket",
    # List the prefix in pages, rather than making an API call per directory.
    "--fast-list",
    # R2's free allowance covers Standard only; never inherit Infrequent Access.
    "--s3-storage-class=STANDARD",
    # rclone reads a bare number as KiB; the B suffix keeps this in bytes.
    f"--s3-upload-cutoff={UPLOAD_CUTOFF_BYTES}B",
    "--retries=3",
    "--contimeout=60s",
    "--use-json-log",
    "-v",
]


# One upload pass per Content-Type, so no type is left to rclone's guesswork:
# immutable objects keep whatever headers their first upload set.
MEDIA_PASSES = (
    ("image/webp", ("webp",), []),
    ("image/jpeg", ("jpg", "jpeg"), []),
    ("image/png", ("png",), []),
    # Untrusted SVG downloads instead of rendering on our origin.
    ("image/svg+xml", ("svg",), ["--header-upload", "Content-Disposition: attachment"]),
    ("application/pdf", ("pdf",), []),
)
assert {f".{e}" for _, exts, _ in MEDIA_PASSES for e in exts} == set(MEDIA_TYPES)


def plan_commands(release: Release, release_dir: Path, target: Target, pointer_file: Path) -> dict:
    """Every rclone invocation by step, in run order. Only `pointer` moves live state."""
    immutable = ["copy", "--checksum", "--immutable", "--header-upload", IMMUTABLE_CACHE]
    denied = [arg for key in release.excluded_media for arg in ("--filter", f"- /{key}")]
    media = target.path(f"{NAMESPACE}/media")
    release_dest = target.path(f"{NAMESPACE}/releases/{release.release_id}")
    commands = {}
    for content_type, extensions, extra in MEDIA_PASSES:
        include = [arg for ext in extensions for arg in ("--filter", f"+ *.{ext}")]
        commands[f"media:{extensions[0]}"] = [
            *immutable,
            "--header-upload",
            f"Content-Type: {content_type}",
            *extra,
            *COMMON_FLAGS,
            "--ignore-case",
            *denied,
            *include,
            "--filter",
            "- **",
            str(release.media_root),
            media,
        ]
    commands["release"] = [
        *immutable,
        "--header-upload",
        "Content-Type: application/json",
        *COMMON_FLAGS,
        str(release_dir),
        release_dest,
    ]
    commands["checkMedia"] = ["check", "--one-way", *COMMON_FLAGS, *denied, str(release.media_root), media]
    commands["hashRelease"] = ["md5sum", *COMMON_FLAGS, release_dest]
    commands["pointer"] = [
        "copyto",
        "--header-upload",
        POINTER_CACHE,
        "--header-upload",
        "Content-Type: application/json",
        *COMMON_FLAGS,
        str(pointer_file),
        target.path(f"{NAMESPACE}/latest.json"),
    ]
    commands["readPointer"] = ["cat", *COMMON_FLAGS, target.path(f"{NAMESPACE}/latest.json")]
    return commands


Runner = Callable[[list[str], dict[str, str], float], subprocess.CompletedProcess]
Fetcher = Callable[[str], tuple[int, dict[str, str], bytes]]


def make_runner(rclone: str) -> Runner:
    def run(args: list[str], env: dict[str, str], timeout: float) -> subprocess.CompletedProcess:
        return subprocess.run(
            [rclone, *args], env=env, capture_output=True, text=True, timeout=timeout, check=False
        )

    return run


def http_get(url: str) -> tuple[int, dict[str, str], bytes]:
    request = urllib.request.Request(url, headers={"User-Agent": "ChooseLife-SlackDataSync/1.0"})
    try:
        with urllib.request.urlopen(request, timeout=60) as response:
            headers = {k.lower(): v for k, v in response.headers.items()}
            return response.status, headers, response.read()
    except urllib.error.HTTPError as error:
        return error.code, {}, b""
    except (urllib.error.URLError, TimeoutError) as error:
        raise SyncError(f"CDN request failed for {url}: {error}") from None


def rclone_stats(stderr: str) -> dict | None:
    """Final transfer/check counts from rclone's JSON log, if present."""
    stats = None
    for line in stderr.splitlines():
        with contextlib.suppress(ValueError):
            entry = json.loads(line)
            if isinstance(entry, dict) and isinstance(entry.get("stats"), dict):
                stats = entry["stats"]
    if not stats:
        return None
    return {k: stats.get(k) for k in ("transfers", "checks", "bytes", "errors")}


def rclone_errors(stderr: str) -> str:
    messages = []
    for line in stderr.splitlines():
        try:
            entry = json.loads(line)
        except ValueError:
            messages.append(line)
            continue
        if isinstance(entry, dict) and entry.get("level") in ("error", "critical", "fatal"):
            messages.append(str(entry.get("msg", "")).strip())
    return "\n".join(messages[-20:])


class Publisher:
    def __init__(self, target: Target, run: Runner, fetch: Fetcher, budget: float = PUBLISH_BUDGET_SECONDS):
        self.target = target
        self.run = run
        self.fetch = fetch
        self.deadline = time.monotonic() + budget

    def rclone(self, step: str, args: list[str], *, allow: tuple[int, ...] = ()) -> subprocess.CompletedProcess:
        remaining = self.deadline - time.monotonic()
        if remaining <= 0:
            raise SyncError(f"Publication exceeded its time budget before {step}")
        try:
            result = self.run(args, self.target.env, remaining)
        except subprocess.TimeoutExpired:
            raise SyncError(f"rclone {step} timed out") from None
        except OSError as error:
            raise SyncError(f"rclone could not start: {error}") from None
        if result.returncode != 0 and result.returncode not in allow:
            raise SyncError(f"rclone {step} failed ({result.returncode}):\n{rclone_errors(result.stderr)}")
        return result

    def read_previous(self, commands: dict) -> tuple[dict | None, dict | None]:
        # rclone exits 3/4 for a missing directory/file: the first publication.
        result = self.rclone("read previous pointer", commands["readPointer"], allow=(3, 4))
        if result.returncode != 0 or not result.stdout.strip():
            return None, None
        pointer = parse_pointer(result.stdout)
        index_args = ["cat", *COMMON_FLAGS, self.target.path(pointer["indexPath"])]
        try:
            index = json.loads(self.rclone("read previous index", index_args).stdout)
        except ValueError:
            raise SyncError("The live release index is not valid JSON") from None
        return pointer, index

    def pointer_is(self, commands: dict, pointer: dict) -> bool:
        try:
            live = parse_pointer(self.rclone("read back pointer", commands["readPointer"]).stdout)
        except SyncError:
            return False
        return live == pointer

    def verify_release_hashes(self, release: Release, commands: dict) -> None:
        """Exact MD5s for the release; also proves R2 exposes MD5 to rclone."""
        expected = {"index.json": hashlib.md5(release.index_bytes).hexdigest()}
        for name, body in release.data_files.items():
            expected[f"data/{name}"] = hashlib.md5(body).hexdigest()
        listed = {}
        for line in self.rclone("hash release", commands["hashRelease"]).stdout.splitlines():
            digest, _, name = line.partition("  ")
            listed[name.strip()] = digest.strip()
        if listed != expected:
            raise SyncError("Release MD5s on R2 differ from the local build (or R2 exposed no MD5)")

    def verify_cdn(self, release: Release) -> None:
        base = self.target.cdn_base_url
        status, _, body = self.fetch(f"{base}/{release.index_path}")
        if status != 200 or body != release.index_bytes:
            raise SyncError(f"CDN did not serve the new index (HTTP {status})")
        photo = first_photo(release.index)
        if not photo:
            return
        status, headers, body = self.fetch(f"{base}/{NAMESPACE}/media/{photo}")
        content_type = headers.get("content-type", "")
        if status != 200 or not body or content_type.split(";")[0] != MEDIA_TYPES[Path(photo).suffix.lower()]:
            raise SyncError(f"CDN did not serve {photo} correctly (HTTP {status}, {content_type!r})")

    def publish(self, release: Release, release_dir: Path, work_dir: Path, *, allow_older_source: bool) -> dict:
        pointer_file = work_dir / "latest.json"
        commands = plan_commands(release, release_dir, self.target, pointer_file)
        previous_pointer, previous_index = self.read_previous(commands)
        source = release.index["source"]
        if (
            previous_pointer
            and previous_pointer["sourceCommittedAt"] > source["committedAt"]
            and not allow_older_source
        ):
            raise SyncError(
                "Source is older than the live release; pass --allow-older-source to roll back deliberately"
            )

        transfers = {}
        for step in [s for s in commands if s.startswith("media:")] + ["release"]:
            transfers[step] = rclone_stats(self.rclone(step, commands[step]).stderr)
        self.rclone("check media", commands["checkMedia"])
        self.verify_release_hashes(release, commands)
        self.verify_cdn(release)

        checked_at = dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
        pointer = {
            "schemaVersion": POINTER_SCHEMA_VERSION,
            "releaseId": release.release_id,
            "indexPath": release.index_path,
            "sourceCommit": source["commit"],
            "sourceCommittedAt": source["committedAt"],
            "sourceVersion": source["catalogueVersion"],
            "lastSuccessfulCheckAt": checked_at,
        }
        pointer_file.write_bytes(canonical(pointer))
        try:
            self.rclone("publish pointer", commands["pointer"])
        except SyncError as error:
            # A lost response may still have written it: read back before deciding.
            error.pointer_unknown = True
            if not self.pointer_is(commands, pointer):
                raise
        else:
            if not self.pointer_is(commands, pointer):
                failure = SyncError("Pointer read-back does not match what was written; inspect before retrying")
                failure.pointer_unknown = True
                raise failure
        return {
            "pointer": pointer,
            "transfers": transfers,
            "changes": diff_indexes(previous_index, release.index),
            "previousReleaseId": previous_pointer["releaseId"] if previous_pointer else None,
        }


def parse_pointer(text: str) -> dict:
    try:
        pointer = json.loads(text)
    except ValueError:
        raise SyncError("latest.json is not valid JSON") from None
    if (
        not isinstance(pointer, dict)
        or pointer.get("schemaVersion") != POINTER_SCHEMA_VERSION
        or not isinstance(pointer.get("releaseId"), str)
        or not RELEASE_ID.match(pointer["releaseId"])
        or pointer.get("indexPath") != f"{NAMESPACE}/releases/{pointer['releaseId']}/index.json"
        or not isinstance(pointer.get("sourceCommittedAt"), str)
    ):
        raise SyncError("latest.json does not match the pointer schema")
    return pointer


def first_photo(index: dict) -> str | None:
    """Nova (54) when present, else the first photo by ID, for the CDN probe."""
    entries = index["webbingsById"]
    for key in ["54", *sorted(entries, key=int)]:
        photos = entries.get(key, {}).get("photos") or []
        if photos:
            return photos[0]["small"]
    return None


@contextlib.contextmanager
def publish_lock(path: Path):
    """One local publisher at a time, so two runs never race the pointer."""
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w") as handle:
        try:
            fcntl.flock(handle, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            raise SyncError(f"Another publish holds {path}") from None
        yield


# ============================================================================
# CLI
# ============================================================================


def parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    source = parser.add_mutually_exclusive_group(required=True)
    source.add_argument("--source-dir", type=Path, help="existing clean checkout of slackdata-data")
    source.add_argument("--source-git", nargs="?", const=UPSTREAM_REPOSITORY, help="shallow-clone this repo")
    parser.add_argument("--source-ref", help="full commit SHA to fetch with --source-git")
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument("--dry-run", action="store_true", help="also print the rclone plan; never runs rclone")
    mode.add_argument("--publish", action="store_true", help="upload to R2 and move latest.json")
    parser.add_argument("--out", type=Path, help="local release directory (default: a temp dir)")
    parser.add_argument("--previous-index", type=Path, help="local index.json to diff against (build/dry-run)")
    parser.add_argument("--rclone-remote", help="use this configured rclone remote instead of SLACKDATA_R2_* credentials")
    parser.add_argument("--rclone", default="rclone", help="rclone binary")
    parser.add_argument(
        "--lock-file",
        type=Path,
        default=Path.home() / ".cache" / "chooselife-slackdata" / "publish.lock",
    )
    parser.add_argument("--allow-older-source", action="store_true", help="deliberate rollback to older upstream data")
    args = parser.parse_args(argv)
    if args.source_ref and not args.source_git:
        parser.error("--source-ref requires --source-git")
    return args


def dry_run_target(args: argparse.Namespace, environ: dict[str, str]) -> Target:
    """Placeholder destination so the plan prints without credentials."""
    bucket = environ.get("SLACKDATA_R2_BUCKET") or "<SLACKDATA_R2_BUCKET>"
    return Target(
        remote=args.rclone_remote or ENV_REMOTE_NAME,
        bucket=bucket,
        cdn_base_url=environ.get("SLACKDATA_CDN_BASE_URL", DEFAULT_CDN_BASE_URL),
        env={},
    )


def run(args: argparse.Namespace, source_root: Path, out_dir: Path) -> dict:
    source = read_source(source_root)
    release = build_release(source)
    release_dir = write_release(release, out_dir)
    summary = {
        "mode": "publish" if args.publish else "dry-run" if args.dry_run else "build",
        "source": release.index["source"],
        "releaseId": release.release_id,
        "releaseDir": str(release_dir),
        "media": {
            "files": release.media_files,
            "bytes": release.media_bytes,
            "excludedByDenylist": release.excluded_media,
        },
        "data": {name: len(body) for name, body in release.data_files.items()},
        "indexBytes": len(release.index_bytes),
        **release.report,
    }
    if args.publish:
        target = resolve_target(args.rclone_remote, dict(os.environ))
        publisher = Publisher(target, make_runner(args.rclone), http_get)
        summary.update(publisher.publish(release, release_dir, out_dir, allow_older_source=args.allow_older_source))
        return summary

    previous = json.loads(args.previous_index.read_bytes()) if args.previous_index else None
    summary["changes"] = diff_indexes(previous, release.index)
    if args.dry_run:
        target = dry_run_target(args, dict(os.environ))
        commands = plan_commands(release, release_dir, target, out_dir / "latest.json")
        summary["plannedRclone"] = [[args.rclone, *commands[step]] for step in commands]
    return summary


def main(argv: list[str] | None = None) -> int:
    args = parse_args(sys.argv[1:] if argv is None else argv)
    # The release directory is kept after exit so every run stays inspectable.
    out_dir = args.out.resolve() if args.out else Path(tempfile.mkdtemp(prefix="slackdata-release-"))
    out_dir.mkdir(parents=True, exist_ok=True)
    try:
        with contextlib.ExitStack() as stack:
            if args.publish:
                # Held from build to read-back, so two local runs never race the pointer.
                stack.enter_context(publish_lock(args.lock_file))
            if args.source_git:
                source_root = stack.enter_context(clone_source(args.source_git, args.source_ref))
            else:
                source_root = args.source_dir
            summary = run(args, source_root, out_dir)
    except SyncError as error:
        print(f"slackdata sync failed: {error}", file=sys.stderr)
        if error.pointer_unknown:
            print("latest.json may have changed: read it back before retrying.", file=sys.stderr)
        else:
            print("latest.json was not changed by this run.", file=sys.stderr)
        return 1
    (out_dir / "summary.json").write_bytes(canonical(summary))
    json.dump(summary, sys.stdout, indent=2, ensure_ascii=False)
    print()
    return 0


if __name__ == "__main__":
    sys.exit(main())
