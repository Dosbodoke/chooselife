import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { SECTIONS, compareCatalogs } from "./check-database-catalog.mjs";
import {
  schemaCatalog,
  migrationSnapshot,
  assertNoMigrationChanges,
  captureCanary,
  missingCanaryDifferences,
  main,
} from "./check-declarative-schema.mjs";

function catalog() {
  return {
    environment: {
      app_owner: "postgres",
      server_version_num: "150000",
      extension_versions: {},
    },
    counts: Object.fromEntries(SECTIONS.map((s) => [s, 0])),
    ...Object.fromEntries(SECTIONS.map((s) => [s, []])),
  };
}

test("schema comparison omits only bucket rows and never changes raw captures", () => {
  const left = catalog();
  const right = catalog();
  left.storage_buckets = [{ id: "legacy", public: true }];
  left.counts.storage_buckets = 1;
  assert.equal(compareCatalogs(left, right).differences.length, 1);
  assert.deepEqual(
    compareCatalogs(schemaCatalog(left), schemaCatalog(right)).differences,
    [],
  );
  assert.equal(left.storage_buckets.length, 1);
  assert.equal(left.counts.storage_buckets, 1);
});

for (const [section, original, changed] of [
  [
    "policies",
    { id: "storage.objects.policy", roles: ["authenticated"] },
    null,
  ],
  [
    "managed_security",
    { id: "relation storage.objects", acl: ["authenticated:SELECT"] },
    { id: "relation storage.objects", acl: ["PUBLIC:SELECT"] },
  ],
  [
    "functions",
    {
      id: "private.dispatch_notification_push()",
      security_definer: true,
      body_digest: "a",
    },
    {
      id: "private.dispatch_notification_push()",
      security_definer: true,
      body_digest: "b",
    },
  ],
  ["triggers", { id: "auth.users.on_auth_user_created" }, null],
  [
    "cron_jobs",
    { id: "billing-generator", command_digest: "a" },
    { id: "billing-generator", command_digest: "b" },
  ],
]) {
  test(`schema projection still rejects changed ${section}`, () => {
    const left = catalog();
    const right = catalog();
    left[section] = [original];
    right[section] = changed ? [changed] : [];
    assert.ok(
      compareCatalogs(schemaCatalog(left), schemaCatalog(right)).differences
        .length > 0,
    );
  });
}

function canaryCatalog() {
  return {
    ...catalog(),
    policies: [
      { id: 'storage.objects."own files"', table: "storage.objects" },
      { id: `public.note."owner's notes"`, table: "public.note" },
    ],
    functions: [
      {
        id: "public.open()",
        kind: "f",
        language: "sql",
        effective: { anon: ["EXECUTE"] },
      },
      {
        id: "public.share(note_id uuid)",
        kind: "f",
        language: "plpgsql",
        effective: { anon: [] },
      },
    ],
    types: [{ id: "public.mood", kind: "e", labels: ["it's", "calm"] }],
  };
}

test("capture canary mutates public objects and names the expected differences", () => {
  const { sql, expected } = captureCanary(canaryCatalog());
  assert.deepEqual(expected, [
    `policies public.note."owner's notes": only in left`,
    "functions public.share(note_id uuid): effective.anon:",
    "functions public.share(note_id uuid): body_digest: differs",
    "types public.mood: labels: differs",
  ]);
  assert.match(sql, /^do \$canary\$/);
  assert.ok(sql.includes(`'drop policy "owner''s notes" on public.note'`));
  assert.ok(
    sql.includes(
      `'alter type public.mood add value ''capture_canary'' before ''it''''s'''`,
    ),
  );
  assert.doesNotMatch(sql, /storage|public\.open/);
});

test("capture canary refuses to run without a target", () => {
  assert.throws(
    () => captureCanary({ ...canaryCatalog(), types: [] }),
    /no public enum/,
  );
});

test("a blind capture leaves canary differences missing", () => {
  const { expected } = captureCanary(canaryCatalog());
  const seen = [
    "functions public.share(note_id uuid): acl: only in left: none; only in right: anon:EXECUTE",
    "functions public.share(note_id uuid): effective.anon: only in left: none; only in right: EXECUTE",
    "functions public.share(note_id uuid): body_digest: differs",
  ];
  assert.deepEqual(missingCanaryDifferences(expected, seen), [
    expected[0],
    expected[3],
  ]);
});

test("no-op verification detects added, removed and modified migrations by content", async () => {
  const root = await fs.mkdtemp(
    path.join(os.tmpdir(), "chooselife-schema-test-"),
  );
  const dir = path.join(root, "supabase/migrations");
  await fs.mkdir(dir, { recursive: true });
  try {
    await fs.writeFile(path.join(dir, "1_original.sql"), "select 1;");
    const before = await migrationSnapshot(root);
    assertNoMigrationChanges(before, await migrationSnapshot(root));
    await fs.writeFile(
      path.join(dir, "2_unexpected.sql"),
      "drop table public.profiles;",
    );
    assert.throws(
      () =>
        assertNoMigrationChanges(before, {
          ...before,
          "2_unexpected.sql": "hash",
        }),
      /2_unexpected.*db:schema:diff.*--keep/,
    );
    assert.throws(() => assertNoMigrationChanges(before, {}), /1_original/);
    await fs.rm(path.join(dir, "2_unexpected.sql"));
    await fs.writeFile(path.join(dir, "1_original.sql"), "select 2;");
    assert.throws(
      () => assertNoMigrationChanges(before, { "1_original.sql": "changed" }),
      /1_original/,
    );
    assert.notDeepEqual(before, await migrationSnapshot(root));
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test("hosted/custom database targets are rejected before preparing any workspace", async () => {
  assert.equal(await main(["--linked"]), 2);
  assert.equal(await main(["--db-url", "postgresql://example"]), 2);
});
