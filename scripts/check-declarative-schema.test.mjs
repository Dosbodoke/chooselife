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
