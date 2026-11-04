#!/usr/bin/env node
// Compare full historical replay with an independent declarative reconstruction.
// Every write targets owned disposable projects; never accepts a hosted target.
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { createHash } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import { compareCatalogs, readCatalog } from "./check-database-catalog.mjs";
import { reconstructionSql } from "./declarative-reconstruction.mjs";
import {
  prepareWorkspace,
  assertOwnedWorkspace,
  cleanupWorkspace,
  describeWorkspace,
  runCliStep as executeCliStep,
  cancelActiveCommand,
  captureCatalog,
  checkMigrations,
  runTests,
  redact,
} from "./verify-database.mjs";

const log = (message) => console.log(`[db:schema:check] ${message}`);
let interrupted;
async function runCliStep(...args) {
  if (interrupted) throw new Error(`Interrupted by ${interrupted}`);
  return executeCliStep(...args);
}

// Bucket rows are operational data delivered by historical migrations, like
// backfills and the festival config singleton. No other catalog field is omitted.
export function schemaCatalog(catalog) {
  return {
    ...catalog,
    storage_buckets: [],
    counts: { ...catalog.counts, storage_buckets: 0 },
  };
}

export async function migrationSnapshot(root) {
  const directory = path.join(root, "supabase/migrations");
  const files = (await fs.readdir(directory))
    .filter((name) => name.endsWith(".sql"))
    .sort();
  return Object.fromEntries(
    await Promise.all(
      files.map(async (name) => [
        name,
        createHash("sha256")
          .update(await fs.readFile(path.join(directory, name)))
          .digest("hex"),
      ]),
    ),
  );
}

export function assertNoMigrationChanges(before, after) {
  if (!isDeepStrictEqual(before, after)) {
    const changed = [
      ...new Set([...Object.keys(before), ...Object.keys(after)]),
    ].filter((name) => before[name] !== after[name]);
    throw new Error(
      `Declarations differ from migration history: ${changed.join(", ")}. Review generated SQL in the disposable project.`,
    );
  }
}

// Supplement the application catalog with role attributes/memberships and
// parameter ACLs. pg_roles deliberately excludes password hashes.
const SECURITY_SQL = `select jsonb_build_object(
  'roles', (select jsonb_agg(jsonb_build_object(
    'name', rolname, 'super', rolsuper, 'inherit', rolinherit,
    'create_role', rolcreaterole, 'create_db', rolcreatedb, 'login', rolcanlogin,
    'replication', rolreplication, 'bypass_rls', rolbypassrls,
    'connection_limit', rolconnlimit, 'config', rolconfig
  ) order by rolname) from pg_roles),
  'memberships', (select jsonb_agg(jsonb_build_object(
    'role', pg_get_userbyid(roleid), 'member', pg_get_userbyid(member),
    'grantor', pg_get_userbyid(grantor), 'admin', admin_option
  ) order by pg_get_userbyid(roleid), pg_get_userbyid(member)) from pg_auth_members),
  'parameters', (select jsonb_agg(jsonb_build_object(
    'name', parname, 'acl', paracl::text
  ) order by parname) from pg_parameter_acl)
) as security`;

async function query(workspace, sql) {
  const result = await runCliStep(workspace, "Local verification query", [
    "db",
    "query",
    "--local",
    "--output",
    "json",
    sql,
  ]);
  return JSON.parse(result.stdout);
}

async function securityState(workspace) {
  return (await query(workspace, SECURITY_SQL))[0].security;
}

// Content hashes never expose rows. Check every application table and sequence
// from the independently captured catalog, plus auth/storage data tables.
async function dataState(workspace, catalog) {
  const tables = catalog.relations
    .filter((r) => ["r", "p"].includes(r.kind))
    .map((r) => r.id);
  tables.push(
    "auth.users",
    "auth.identities",
    "storage.buckets",
    "storage.objects",
  );
  const state = {};
  for (const table of [...new Set(tables)].sort()) {
    // Names come only from pg_catalog's quoted identifiers, never user input.
    state[table] = await query(
      workspace,
      `select count(*)::text as rows,
      md5(coalesce(string_agg(row_digest, '' order by row_digest), '')) as digest
      from (select md5(row_to_json(t)::text) as row_digest from ${table} t) rows`,
    );
  }
  for (const relation of catalog.relations.filter((r) => r.kind === "S")) {
    state[relation.id] = await query(
      workspace,
      `select last_value::text, is_called from ${relation.id}`,
    );
  }
  return state;
}

async function start(workspace) {
  await assertOwnedWorkspace(workspace);
  // Startup stdout includes local keys: discard it even on failure.
  try {
    await runCliStep(workspace, "Starting disposable stack", ["start"]);
  } catch {
    throw new Error(
      `Could not start ${workspace.projectId}. Check Docker and available ports.`,
    );
  }
}

async function sync(workspace, name) {
  await assertOwnedWorkspace(workspace);
  return runCliStep(workspace, "Strict declarative sync", [
    "db",
    "schema",
    "declarative",
    "sync",
    "-f",
    name,
    "--no-apply",
    "--strict-coverage",
  ]);
}

export async function main(argv) {
  if (argv.includes("--help")) {
    console.log(
      "Usage: pnpm db:schema:check [--keep]\nChecks replay, pgTAP, no-op sync, row preservation and independent catalog/security parity in disposable projects.",
    );
    return 0;
  }
  if (argv.some((arg) => arg !== "--keep")) {
    console.error("Only --keep is supported; remote targets are forbidden.");
    return 2;
  }
  const keep = argv.includes("--keep");
  const workspaces = [];
  let failed = false;
  let cleaningUp = false;
  interrupted = undefined;
  const onSignal = (signal) => {
    interrupted ||= signal;
    if (!cleaningUp) cancelActiveCommand(signal);
  };
  process.on("SIGINT", onSignal);
  process.on("SIGTERM", onSignal);
  try {
    const replay = await prepareWorkspace();
    workspaces.push(replay);
    log(
      `Replay: ${replay.migrationVersions.length} migrations, ${replay.testFiles.length} SQL test files`,
    );
    await start(replay);
    await assertOwnedWorkspace(replay);
    await runCliStep(replay, "Full historical replay", [
      "db",
      "reset",
      "--local",
      "--yes",
    ]);
    log(await checkMigrations(replay));
    await captureCatalog(replay);
    const baseline = await readCatalog(replay.catalogFile);
    const baselineSecurity = await securityState(replay);
    const beforeData = await dataState(replay, baseline);
    const beforeMigrations = await migrationSnapshot(replay.root);
    log("Checking strict no-op sync against full migration history");
    await sync(replay, "verify_declarative_noop");
    assertNoMigrationChanges(
      beforeMigrations,
      await migrationSnapshot(replay.root),
    );
    await runCliStep(replay, "Applying pending local migrations", [
      "migration",
      "up",
      "--local",
    ]);
    if (!isDeepStrictEqual(beforeData, await dataState(replay, baseline)))
      throw new Error(
        "Application/auth/storage rows or sequence state changed during no-op adoption.",
      );
    log(
      `No migration generated; rows and sequences unchanged across ${Object.keys(beforeData).length} relations`,
    );
    await runCliStep(replay, "SQL lint", [
      "db",
      "lint",
      "--local",
      "--schema",
      "public,private",
      "--level",
      "error",
      "--fail-on",
      "error",
    ]);
    log(`pgTAP: ${await runTests(replay)}`);
    // Release memory before building the independent platform database.
    await cleanupWorkspace(replay);
    workspaces.pop();

    const declared = await prepareWorkspace();
    workspaces.push(declared);
    await fs.writeFile(
      path.join(declared.root, "replay-catalog.json"),
      JSON.stringify(baseline),
    );
    await fs.writeFile(
      path.join(declared.root, "replay-security.json"),
      JSON.stringify(baselineSecurity),
    );
    await assertOwnedWorkspace(declared);
    const migrations = path.join(declared.root, "supabase/migrations");
    await fs.rm(migrations, { recursive: true });
    await fs.mkdir(migrations);
    const configPath = path.join(declared.root, "supabase/config.toml");
    const config = await fs.readFile(configPath, "utf8");
    await fs.writeFile(
      configPath,
      config.replace(/(\[db\.seed\][\s\S]*?enabled\s*=\s*)true/, "$1false"),
    );
    log(
      "Reconstructing declarations on a fresh platform with no historical migrations or seeds",
    );
    await start(declared);
    const reconstruction = path.join(declared.root, "reconstruction.sql");
    await fs.writeFile(
      reconstruction,
      await reconstructionSql(path.join(declared.root, "supabase/schemas")),
    );
    await runCliStep(declared, "Applying independent declarations", [
      "db",
      "query",
      "--local",
      "--file",
      reconstruction,
    ]);
    await captureCatalog(declared);
    const reconstructed = await readCatalog(declared.catalogFile);
    const { differences, environment } = compareCatalogs(
      schemaCatalog(baseline),
      schemaCatalog(reconstructed),
    );
    if (differences.length || environment.length)
      throw new Error(
        `Independent catalog parity failed:\n${[...differences, ...environment].join("\n")}`,
      );
    if (!isDeepStrictEqual(baselineSecurity, await securityState(declared)))
      throw new Error(
        "Role attributes/memberships or parameter ACLs differ after reconstruction.",
      );
    const count = Object.values(schemaCatalog(baseline).counts).reduce(
      (a, b) => a + b,
      0,
    );
    log(
      `Independent parity: ${count} catalog objects; role attributes, memberships and parameter ACLs match`,
    );
    log("All declarative schema checks passed.");
  } catch (error) {
    failed = true;
    console.error(`[db:schema:check] ${error.message}`);
    if (error.output)
      console.error(redact(error.output).split("\n").slice(-35).join("\n"));
  } finally {
    cleaningUp = true;
    for (const workspace of workspaces.reverse()) {
      if (keep && failed) {
        console.log(JSON.stringify(describeWorkspace(workspace), null, 2));
        continue;
      }
      try {
        await cleanupWorkspace(workspace);
      } catch (error) {
        failed = true;
        console.error(
          `Cleanup failed: ${error.message}\n${describeWorkspace(workspace).cleanup}`,
        );
      }
    }
    process.off("SIGINT", onSignal);
    process.off("SIGTERM", onSignal);
  }
  return interrupted ? 128 + os.constants.signals[interrupted] : failed ? 1 : 0;
}

if (import.meta.main) process.exitCode = await main(process.argv.slice(2));
