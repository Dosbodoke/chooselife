"""Synthetic tests for sync.py. Run from the repo root:

    python3 -m unittest discover -s scripts/slackdata -p 'test_*.py'
"""

from __future__ import annotations

import contextlib
import hashlib
import io
import json
import os
import re
import shutil
import socket
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock

sys.path.insert(0, str(Path(__file__).parent))
import sync  # noqa: E402

NOVA_SMALL = "webbings/54/5ef8465af089d95b-480.webp"
NOVA_LARGE = "webbings/54/5ef8465af089d95b-1600.webp"
MAGIC_SMALL = "webbings/265/6b6d604f26f8c624-480.webp"
MAGIC_LARGE = "webbings/265/6b6d604f26f8c624-1600.webp"


def photo(webbing_id: int, photo_id: str) -> dict:
    return {
        "id": photo_id,
        "small": f"webbings/{webbing_id}/{photo_id}-480.webp",
        "large": f"webbings/{webbing_id}/{photo_id}-1600.webp",
    }


def warning(warning_id: str, confidence: str, ids: list[int], gear_type: str | None = "webbing", **extra) -> dict:
    return {
        "id": warning_id,
        "status": "Recall",
        "description": f"Description {warning_id}",
        "solution": "Do NOT use for highlining.",
        "productImage": "https://example.com/remote.jpg",
        "link1": "https://example.com/notice",
        "link2": "javascript:alert(1)",
        "match": {"gearType": gear_type, "gearIds": ids, "gearNames": [], "confidence": confidence},
        **extra,
    }


def default_webbings() -> list:
    return [
        {"id": 54, "name": "Nova", "brand": "Slack Inov", "photos": [photo(54, "5ef8465af089d95b"), photo(54, "0f34b314bf5aed2c")]},
        {"id": 265, "name": "Nova Magic 25", "brand": "Landcruising", "photos": [photo(265, "6b6d604f26f8c624")]},
        {"id": 7, "name": "No Photos", "brand": None},
        {"id": 8, "name": "Null Photos", "brand": "Brand", "photos": None},
    ]


def default_warnings() -> dict:
    return {
        "items": [
            warning("10", "exact", [54]),
            warning("11", "exact", [54], description="<b>Second</b> notice"),
            warning("12", "likely", [265]),
            warning("13", "ambiguous", [54, 265]),
            warning("14", "partial", [7]),
            warning("15", "none", [], gear_type=None),
            warning("16", "exact", [54], gear_type="weblock"),
            warning("17", "exact", [999]),
            {"id": "18", "match": "garbage"},
        ]
    }


RCLONE_SIZE_UNITS = {"B": 1, "K": 1024, "M": 1024**2, "G": 1024**3, "T": 1024**4, "P": 1024**5}


def rclone_size_bytes(value: str) -> int:
    """Parse an rclone size flag the way rclone does: a bare number means KiB."""
    match = re.fullmatch(r"(\d+)([BKMGTP]?)", value, re.IGNORECASE)
    if not match:
        raise ValueError(f"not an rclone size: {value!r}")
    return int(match[1]) * RCLONE_SIZE_UNITS[(match[2] or "K").upper()]


class Fixture:
    """A throwaway git checkout shaped like slackdata-data."""

    def __init__(self, tmp: Path, webbings=None, warnings=None, extra_media=()):
        self.root = tmp / "checkout"
        self.data = self.root / "data"
        self.media = self.data / "media"
        self.media.mkdir(parents=True)
        webbings = default_webbings() if webbings is None else webbings
        self.write_json("webbings.json", webbings)
        self.write_json("isa_gear_warnings.json", default_warnings() if warnings is None else warnings)
        self.write_json("catalogue.json", {"version": 3, "source": "store"})
        self.write_json("weblocks.json", [{"id": 1, "name": "Lock"}])
        self.write_json("changes.json", [{"who": "Private Name"}])
        for record in webbings if isinstance(webbings, list) else []:
            for item in (record.get("photos") if isinstance(record, dict) else None) or []:
                for size in ("small", "large"):
                    key = item.get(size) if isinstance(item, dict) else None
                    if isinstance(key, str) and sync.is_safe_key(key):
                        self.add_media(key, f"bytes of {key}".encode())
        for key in extra_media:
            self.add_media(key, b"x")
        self.commit()

    def write_json(self, name: str, value) -> None:
        (self.data / name).write_text(json.dumps(value))

    def add_media(self, key: str, body: bytes) -> None:
        path = self.media / key
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(body)

    def commit(self) -> None:
        env = {
            **os.environ,
            "GIT_AUTHOR_DATE": "2026-10-16T23:34:05+00:00",
            "GIT_COMMITTER_DATE": "2026-10-16T23:34:05+00:00",
        }
        for args in (
            ["init", "--quiet"],
            ["add", "-A"],
            ["-c", "user.name=t", "-c", "user.email=t@example.com", "commit", "--quiet", "--allow-empty", "-m", "fixture"],
        ):
            subprocess.run(["git", "-C", str(self.root), *args], check=True, env=env, capture_output=True)

    def build(self, **kwargs) -> sync.Release:
        return sync.build_release(sync.read_source(self.root), **kwargs)


class TempCase(unittest.TestCase):
    def setUp(self):
        self._tmp = tempfile.TemporaryDirectory()
        self.tmp = Path(self._tmp.name)
        self.addCleanup(self._tmp.cleanup)
        # Never read the repo's real denylist in tests.
        self.denylist = self.tmp / "denylist.txt"

    def fixture(self, **kwargs) -> Fixture:
        return Fixture(self.tmp, **kwargs)

    def build(self, fixture: Fixture) -> sync.Release:
        return fixture.build(denylist=self.denylist)

    def assertRejected(self, fixture: Fixture, fragment: str):
        with self.assertRaises(sync.SyncError) as caught:
            self.build(fixture)
        self.assertIn(fragment, str(caught.exception))


class IndexTests(TempCase):
    def test_photos_are_associated_by_id_not_name(self):
        release = self.build(self.fixture())
        entries = release.index["webbingsById"]
        self.assertEqual(entries["54"]["photos"][0]["small"], NOVA_SMALL)
        self.assertEqual(entries["54"]["photos"][0]["large"], NOVA_LARGE)
        self.assertEqual(entries["265"]["photos"][0]["small"], MAGIC_SMALL)
        self.assertEqual(entries["265"]["photos"][0]["large"], MAGIC_LARGE)
        self.assertEqual((entries["54"]["name"], entries["54"]["brand"]), ("Nova", "Slack Inov"))
        self.assertEqual((entries["265"]["name"], entries["265"]["brand"]), ("Nova Magic 25", "Landcruising"))

    def test_photo_order_is_preserved(self):
        release = self.build(self.fixture())
        ids = [p["id"] for p in release.index["webbingsById"]["54"]["photos"]]
        self.assertEqual(ids, ["5ef8465af089d95b", "0f34b314bf5aed2c"])

    def test_missing_or_null_photos_are_an_empty_list(self):
        entries = self.build(self.fixture()).index["webbingsById"]
        self.assertEqual(entries["7"]["photos"], [])
        self.assertEqual(entries["8"]["photos"], [])
        self.assertIsNone(entries["7"]["brand"])

    def test_only_exact_webbing_matches_attach(self):
        release = self.build(self.fixture())
        entries = release.index["webbingsById"]
        self.assertEqual([w["id"] for w in entries["54"]["warnings"]], ["10", "11"])
        self.assertEqual(entries["265"]["warnings"], [])
        self.assertEqual(entries["7"]["warnings"], [])
        matches = release.index["warningMatches"]
        self.assertEqual(
            matches["byConfidence"],
            {"exact": 4, "likely": 1, "ambiguous": 1, "partial": 1, "none": 1, "malformed": 1},
        )
        self.assertEqual(matches["webbing"], {"attached": 2, "skippedUncertain": 3, "exactUnknownId": 1})

    def test_warning_text_is_verbatim_and_remote_images_dropped(self):
        warnings = self.build(self.fixture()).index["webbingsById"]["54"]["warnings"]
        second = warnings[1]
        self.assertEqual(second["description"], "<b>Second</b> notice")
        self.assertEqual(second["solution"], "Do NOT use for highlining.")
        self.assertEqual(second["links"], ["https://example.com/notice"])
        self.assertNotIn("productImage", second)
        self.assertEqual(second["match"], {"gearType": "webbing", "gearIds": [54], "confidence": "exact"})

    def test_raw_warnings_are_kept_whole_and_changes_excluded(self):
        fixture = self.fixture()
        release = self.build(fixture)
        self.assertEqual(
            release.data_files["isa_gear_warnings.json"],
            (fixture.data / "isa_gear_warnings.json").read_bytes(),
        )
        self.assertNotIn("changes.json", release.data_files)
        self.assertIn("weblocks.json", release.data_files)

    def test_source_metadata_is_recorded(self):
        release = self.build(self.fixture())
        source = release.index["source"]
        self.assertRegex(source["commit"], r"^[0-9a-f]{40}$")
        self.assertEqual(source["committedAt"], "2026-10-16T23:34:05Z")
        self.assertEqual(source["catalogueVersion"], 3)

    def test_unreferenced_media_is_still_mirrored(self):
        release = self.build(self.fixture(extra_media=["brands/1/logo.svg", "webbings/1/manual.pdf"]))
        self.assertEqual(release.media_files, 8)


class DigestTests(TempCase):
    def test_same_input_gives_same_release(self):
        fixture = self.fixture()
        first = self.build(fixture)
        second = self.build(fixture)
        self.assertEqual(first.release_id, second.release_id)
        self.assertEqual(first.index_bytes, second.index_bytes)

    def test_publisher_output_change_gives_new_release(self):
        fixture = self.fixture()
        before = self.build(fixture).release_id
        with mock.patch.object(sync, "INDEX_SCHEMA_VERSION", 2):
            self.assertNotEqual(before, self.build(fixture).release_id)

    def test_raw_data_change_gives_new_release(self):
        fixture = self.fixture()
        before = self.build(fixture).release_id
        fixture.write_json("weblocks.json", [{"id": 1, "name": "Lock 2"}])
        fixture.commit()
        self.assertNotEqual(before, self.build(fixture).release_id)

    def test_denylist_removes_photo_and_changes_release(self):
        fixture = self.fixture()
        before = self.build(fixture).release_id
        self.denylist.write_text(f"# removal request\n{NOVA_SMALL}\n")
        release = self.build(fixture)
        self.assertNotEqual(before, release.release_id)
        self.assertEqual([p["id"] for p in release.index["webbingsById"]["54"]["photos"]], ["0f34b314bf5aed2c"])
        self.assertEqual(release.excluded_media, [NOVA_SMALL])


class ValidationTests(TempCase):
    def with_photo(self, small: str, large: str | None = None, webbing_id: int = 54) -> Fixture:
        webbings = [{"id": webbing_id, "name": "X", "brand": "Y", "photos": [{"id": "p", "small": small, "large": large or small}]}]
        return self.fixture(webbings=webbings)

    def test_rejects_duplicate_ids(self):
        webbings = default_webbings() + [{"id": 54, "name": "Again", "brand": None}]
        self.assertRejected(self.fixture(webbings=webbings), "Duplicate webbing id 54")

    def test_rejects_invalid_ids(self):
        for bad in (0, -1, True, "54", 1.5, None):
            with self.subTest(bad=bad):
                tmp = self.tmp / f"case-{bad!r}"
                tmp.mkdir()
                fixture = Fixture(tmp, webbings=[{"id": bad, "name": "X"}])
                with self.assertRaises(sync.SyncError):
                    fixture.build(denylist=self.denylist)

    def test_rejects_empty_catalog(self):
        self.assertRejected(self.fixture(webbings=[]), "nonempty array")

    def test_rejects_unsafe_paths(self):
        cases = {
            "traversal": "webbings/54/../55/x-480.webp",
            "parent": "../outside.webp",
            "absolute": "/etc/passwd",
            "backslash": "webbings\\54\\x.webp",
            "dot segment": "webbings/./54/x.webp",
            "hidden": "webbings/54/.x.webp",
            "url": "https://example.com/x.webp",
        }
        for label, key in cases.items():
            with self.subTest(label):
                tmp = self.tmp / label.replace(" ", "-")
                tmp.mkdir()
                webbings = [{"id": 54, "name": "X", "photos": [{"id": "p", "small": key, "large": key}]}]
                with self.assertRaises(sync.SyncError) as caught:
                    Fixture(tmp, webbings=webbings).build(denylist=self.denylist)
                self.assertIn("unsafe", str(caught.exception))

    def test_rejects_photo_owned_by_another_record(self):
        self.assertRejected(self.with_photo(MAGIC_SMALL, MAGIC_LARGE, webbing_id=54), "belongs to another record")

    def test_rejects_missing_referenced_media(self):
        fixture = self.fixture()
        (fixture.media / NOVA_LARGE).unlink()
        fixture.commit()
        self.assertRejected(fixture, "missing media")

    def test_rejects_empty_referenced_media(self):
        fixture = self.fixture()
        (fixture.media / NOVA_SMALL).write_bytes(b"")
        fixture.commit()
        self.assertRejected(fixture, "empty media")

    def test_rejects_symlinks(self):
        fixture = self.fixture()
        (fixture.media / "webbings/54/link.webp").symlink_to(fixture.media / NOVA_SMALL)
        fixture.commit()
        self.assertRejected(fixture, "Symlink")

    def test_rejects_symlinked_directory(self):
        fixture = self.fixture()
        (fixture.media / "escape").symlink_to(self.tmp)
        fixture.commit()
        self.assertRejected(fixture, "Symlink")

    def test_rejects_unsupported_media_type(self):
        fixture = self.fixture(extra_media=["webbings/54/page.html"])
        self.assertRejected(fixture, "Unsupported media type")

    def test_rejects_dirty_checkout(self):
        fixture = self.fixture()
        fixture.add_media("webbings/54/untracked.webp", b"x")
        with self.assertRaises(sync.SyncError) as caught:
            sync.read_source(fixture.root)
        self.assertIn("local changes", str(caught.exception))

    def test_rejects_missing_warnings_file(self):
        fixture = self.fixture()
        (fixture.data / "isa_gear_warnings.json").unlink()
        fixture.commit()
        self.assertRejected(fixture, "isa_gear_warnings.json")


# ============================================================================
# Publication ordering with a stub rclone
# ============================================================================


class FakeR2:
    """Answers rclone calls by step; `fail` names the step that errors."""

    def __init__(self, release: sync.Release, previous_pointer: dict | None = None, fail: str | None = None):
        self.release = release
        self.pointer_text = sync.canonical(previous_pointer).decode() if previous_pointer else None
        self.fail = fail
        self.steps: list[str] = []
        self.md5_override: dict | None = None
        self.lose_pointer_response = False

    @staticmethod
    def step(args: list[str]) -> str:
        if args[0] == "copy":
            content_type = next(a for a in args if a.startswith("Content-Type: "))
            return "release" if content_type.endswith("json") else f"media:{content_type[14:]}"
        if args[0] == "cat":
            return "cat-pointer" if args[-1].endswith("latest.json") else "cat-index"
        return {"check": "check", "md5sum": "md5sum", "copyto": "pointer"}[args[0]]

    def __call__(self, args, env, timeout):
        step = self.step(args)
        self.steps.append(step)
        if step == self.fail:
            return subprocess.CompletedProcess(args, 1, "", '{"level":"error","msg":"boom"}\n')
        if step == "cat-pointer":
            if self.pointer_text is None:
                return subprocess.CompletedProcess(args, 3, "", "directory not found\n")
            return subprocess.CompletedProcess(args, 0, self.pointer_text, "")
        if step == "cat-index":
            return subprocess.CompletedProcess(args, 0, json.dumps({"webbingsById": {}}), "")
        if step == "md5sum":
            sums = self.md5_override or self.expected_md5()
            return subprocess.CompletedProcess(args, 0, "".join(f"{v}  {k}\n" for k, v in sums.items()), "")
        if step == "pointer":
            self.pointer_text = Path(args[-2]).read_text()
            if self.lose_pointer_response:
                return subprocess.CompletedProcess(args, 1, "", "connection reset\n")
        stats = '{"level":"info","msg":"done","stats":{"transfers":0,"checks":5,"bytes":0,"errors":0}}\n'
        return subprocess.CompletedProcess(args, 0, "", stats)

    def expected_md5(self) -> dict:
        sums = {"index.json": hashlib.md5(self.release.index_bytes).hexdigest()}
        for name, body in self.release.data_files.items():
            sums[f"data/{name}"] = hashlib.md5(body).hexdigest()
        return sums


def cdn(release: sync.Release, *, index_status=200, photo_type="image/webp"):
    def fetch(url: str):
        if url.endswith("/index.json"):
            return index_status, {}, release.index_bytes if index_status == 200 else b""
        return 200, {"content-type": photo_type}, b"image"

    return fetch


PRE_POINTER_STEPS = ["media:image/webp", "media:image/jpeg", "media:image/png", "media:image/svg+xml", "media:application/pdf", "release", "check", "md5sum"]


class PublishTests(TempCase):
    def setUp(self):
        super().setUp()
        self.release = self.build(self.fixture())
        self.out = self.tmp / "out"
        self.release_dir = sync.write_release(self.release, self.out)
        self.target = sync.Target(remote="stub", bucket="chooselife", cdn_base_url="https://cdn.example.com", env={})

    def publish(self, fake: FakeR2, fetch=None, allow_older_source=False):
        publisher = sync.Publisher(self.target, fake, fetch or cdn(self.release))
        return publisher.publish(self.release, self.release_dir, self.out, allow_older_source=allow_older_source)

    def test_success_writes_pointer_last_and_reads_it_back(self):
        fake = FakeR2(self.release)
        result = self.publish(fake)
        self.assertEqual(fake.steps, ["cat-pointer", *PRE_POINTER_STEPS, "pointer", "cat-pointer"])
        pointer = json.loads(fake.pointer_text)
        self.assertEqual(pointer["releaseId"], self.release.release_id)
        self.assertEqual(pointer["indexPath"], f"slackdata/releases/{self.release.release_id}/index.json")
        self.assertEqual(pointer["sourceVersion"], 3)
        self.assertEqual(set(pointer), {"schemaVersion", "releaseId", "indexPath", "sourceCommit", "sourceCommittedAt", "sourceVersion", "lastSuccessfulCheckAt"})
        self.assertIsNone(result["previousReleaseId"])

    def test_no_pointer_after_any_transfer_or_verification_failure(self):
        for step in PRE_POINTER_STEPS:
            with self.subTest(step=step):
                fake = FakeR2(self.release, fail=step)
                with self.assertRaises(sync.SyncError) as caught:
                    self.publish(fake)
                self.assertNotIn("pointer", fake.steps)
                self.assertFalse(caught.exception.pointer_unknown)

    def test_no_pointer_when_r2_exposes_no_md5(self):
        fake = FakeR2(self.release)
        fake.md5_override = {name: "" for name in fake.expected_md5()}
        with self.assertRaises(sync.SyncError):
            self.publish(fake)
        self.assertNotIn("pointer", fake.steps)

    def test_no_pointer_when_cdn_misses_index_or_serves_wrong_type(self):
        for fetch in (cdn(self.release, index_status=404), cdn(self.release, photo_type="text/html")):
            fake = FakeR2(self.release)
            with self.assertRaises(sync.SyncError):
                self.publish(fake, fetch)
            self.assertNotIn("pointer", fake.steps)

    def test_no_uploads_when_previous_pointer_is_unreadable(self):
        fake = FakeR2(self.release, fail="cat-pointer")
        with self.assertRaises(sync.SyncError):
            self.publish(fake)
        self.assertEqual(fake.steps, ["cat-pointer"])

    def test_refuses_older_source_unless_allowed(self):
        newer = {
            "schemaVersion": 1,
            "releaseId": "a" * 64,
            "indexPath": f"slackdata/releases/{'a' * 64}/index.json",
            "sourceCommittedAt": "2027-01-01T00:00:00Z",
        }
        fake = FakeR2(self.release, previous_pointer=newer)
        with self.assertRaises(sync.SyncError):
            self.publish(fake)
        self.assertEqual(fake.steps, ["cat-pointer", "cat-index"])
        fake = FakeR2(self.release, previous_pointer=newer)
        result = self.publish(fake, allow_older_source=True)
        self.assertEqual(result["previousReleaseId"], "a" * 64)

    def test_lost_pointer_response_is_resolved_by_read_back(self):
        fake = FakeR2(self.release)
        fake.lose_pointer_response = True
        result = self.publish(fake)
        self.assertEqual(result["pointer"]["releaseId"], self.release.release_id)
        self.assertEqual(fake.steps[-2:], ["pointer", "cat-pointer"])

    def test_failed_pointer_write_reports_unknown_state(self):
        fake = FakeR2(self.release, fail="pointer")
        with self.assertRaises(sync.SyncError) as caught:
            self.publish(fake)
        self.assertTrue(caught.exception.pointer_unknown)

    def test_all_destinations_stay_inside_namespace(self):
        commands = sync.plan_commands(self.release, self.release_dir, self.target, self.out / "latest.json")
        for step, args in commands.items():
            remote_args = [a for a in args if a.startswith("stub:")]
            self.assertEqual(len(remote_args), 1, step)
            self.assertTrue(remote_args[0].startswith("stub:chooselife/slackdata/"), step)
        for step in [s for s in commands if s.startswith("media:")] + ["release"]:
            self.assertIn("--immutable", commands[step])
            self.assertIn("--checksum", commands[step])
            self.assertNotIn("sync", commands[step])
        for args in commands.values():
            self.assertIn("--s3-storage-class=STANDARD", args)
            self.assertIn("--fast-list", args)
        self.assertNotIn("--immutable", commands["pointer"])
        self.assertIn(sync.POINTER_CACHE, commands["pointer"])
        with self.assertRaises(sync.SyncError):
            self.target.path("avatars/x.png")
        with self.assertRaises(sync.SyncError):
            self.target.path("slackdata/../avatars/x.png")

    def test_svg_downloads_instead_of_rendering(self):
        commands = sync.plan_commands(self.release, self.release_dir, self.target, self.out / "latest.json")
        self.assertIn("Content-Disposition: attachment", commands["media:svg"])
        self.assertNotIn("Content-Disposition: attachment", commands["media:webp"])

    def test_upload_cutoff_is_200_mib_as_rclone_reads_it(self):
        # A bare 209715200 is read as KiB (200Gi) and rclone refuses it before any request.
        commands = sync.plan_commands(self.release, self.release_dir, self.target, self.out / "latest.json")
        for step, args in commands.items():
            cutoffs = [a.split("=", 1)[1] for a in args if a.startswith("--s3-upload-cutoff=")]
            self.assertEqual(cutoffs, ["209715200B"], step)
            size = rclone_size_bytes(cutoffs[0])
            self.assertEqual(size, 200 * 1024**2, step)
            self.assertGreater(size, sync.MAX_MEDIA_BYTES, step)
            self.assertLessEqual(size, 5 * 1024**3, step)

    @unittest.skipUnless(shutil.which("rclone"), "rclone not installed")
    def test_real_rclone_accepts_generated_flags(self):
        # The generated readPointer argv against a closed loopback port: no R2, no network.
        with socket.socket() as probe:
            probe.bind(("127.0.0.1", 0))
            port = probe.getsockname()[1]
        environ = {
            "PATH": os.environ.get("PATH", ""),
            "HOME": str(self.tmp),
            "RCLONE_CONFIG": str(self.tmp / "rclone.conf"),
            "RCLONE_LOW_LEVEL_RETRIES": "1",
            "SLACKDATA_R2_BUCKET": "chooselife",
            "SLACKDATA_R2_ENDPOINT": f"http://127.0.0.1:{port}",
            "SLACKDATA_R2_ACCESS_KEY_ID": "probe",
            "SLACKDATA_R2_SECRET_ACCESS_KEY": "probe",
        }
        (self.tmp / "rclone.conf").write_text("")
        target = sync.resolve_target(None, environ)
        args = sync.plan_commands(self.release, self.release_dir, target, self.out / "latest.json")["readPointer"]
        result = sync.make_runner(shutil.which("rclone"))(args, target.env, 60)
        self.assertNotIn("upload cutoff", result.stderr)
        # Reaching the endpoint means rclone built the S3 backend with every flag.
        self.assertIn(f"127.0.0.1:{port}", result.stderr)

    def test_missing_rclone_fails_cleanly_before_pointer(self):
        publisher = sync.Publisher(self.target, sync.make_runner(str(self.tmp / "no-rclone")), cdn(self.release))
        with self.assertRaises(sync.SyncError) as caught:
            publisher.publish(self.release, self.release_dir, self.out, allow_older_source=False)
        self.assertFalse(caught.exception.pointer_unknown)

    def test_concurrent_publish_is_refused(self):
        lock = self.tmp / "publish.lock"
        with sync.publish_lock(lock):
            with self.assertRaises(sync.SyncError):
                with sync.publish_lock(lock):
                    pass
        with sync.publish_lock(lock):
            pass


class CliTests(TempCase):
    def test_build_and_dry_run_never_invoke_rclone(self):
        fixture = self.fixture()
        marker = self.tmp / "rclone-called"
        stub = self.tmp / "rclone"
        stub.write_text(f"#!/bin/sh\ntouch {marker}\nexit 1\n")
        stub.chmod(0o755)
        env = {k: v for k, v in os.environ.items() if not k.startswith("SLACKDATA_")}
        with mock.patch.dict(os.environ, env, clear=True):
            for mode in ([], ["--dry-run"]):
                with self.subTest(mode=mode):
                    out = io.StringIO()
                    with contextlib.redirect_stdout(out), mock.patch.object(sync, "DENYLIST_PATH", self.denylist):
                        code = sync.main(["--source-dir", str(fixture.root), "--out", str(self.tmp / "out"), "--rclone", str(stub), *mode])
                    self.assertEqual(code, 0)
                    summary = json.loads(out.getvalue())
                    self.assertEqual(summary["webbings"], 4)
                    self.assertEqual("plannedRclone" in summary, bool(mode))
        self.assertFalse(marker.exists())

    def test_publish_requires_credentials_before_touching_r2(self):
        fixture = self.fixture()
        env = {k: v for k, v in os.environ.items() if not k.startswith("SLACKDATA_")}
        err = io.StringIO()
        with mock.patch.dict(os.environ, env, clear=True), contextlib.redirect_stderr(err):
            code = sync.main(["--source-dir", str(fixture.root), "--out", str(self.tmp / "out"), "--publish", "--rclone", "/nonexistent", "--lock-file", str(self.tmp / "lock")])
        self.assertEqual(code, 1)
        self.assertIn("SLACKDATA_R2_BUCKET", err.getvalue())
        self.assertIn("was not changed", err.getvalue())

    def test_env_credentials_stay_out_of_argv(self):
        environ = {
            "SLACKDATA_R2_BUCKET": "chooselife",
            "SLACKDATA_R2_ENDPOINT": "https://account.r2.cloudflarestorage.com",
            "SLACKDATA_R2_ACCESS_KEY_ID": "AKIDSECRET",
            "SLACKDATA_R2_SECRET_ACCESS_KEY": "TOPSECRET",
        }
        target = sync.resolve_target(None, environ)
        self.assertEqual(target.env["RCLONE_CONFIG_SLACKDATAR2_SECRET_ACCESS_KEY"], "TOPSECRET")
        self.assertEqual(target.env["RCLONE_CONFIG_SLACKDATAR2_PROVIDER"], "Cloudflare")
        release = self.build(self.fixture())
        commands = sync.plan_commands(release, self.tmp, target, self.tmp / "latest.json")
        flat = " ".join(a for args in commands.values() for a in args)
        self.assertNotIn("TOPSECRET", flat)
        self.assertNotIn("AKIDSECRET", flat)

    def test_rejects_non_https_cdn_and_bad_bucket(self):
        with self.assertRaises(sync.SyncError):
            sync.resolve_target("r2", {"SLACKDATA_R2_BUCKET": "chooselife", "SLACKDATA_CDN_BASE_URL": "http://evil.example"})
        with self.assertRaises(sync.SyncError):
            sync.resolve_target("r2", {"SLACKDATA_R2_BUCKET": "../x"})
        with self.assertRaises(sync.SyncError):
            sync.resolve_target("r2:other", {"SLACKDATA_R2_BUCKET": "chooselife"})


if __name__ == "__main__":
    unittest.main()
