#!/usr/bin/env node
// Replay every migration, seed and SQL test in a disposable Supabase project.
//
// Usage: pnpm db:verify [--keep] [--check-types]
//
// Copies the repository's Supabase inputs into a fresh temp directory with its
// own project ID and ports, then starts that copy, resets it, checks applied
// migration versions, captures the schema catalog, lints and runs pgTAP. Only
// the copy's containers and directory are touched, so an existing local stack
// keeps running.
// Exit codes: 0 success, 1 verification or cleanup failure, 2 usage error,
// 128 + signal number when interrupted.

import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import fs from "node:fs/promises";
import net from "node:net";
import os from "node:os";
import path from "node:path";

import { extractCatalog } from "./check-database-catalog.mjs";

const REPO_ROOT = path.resolve(import.meta.dirname, "..");
const CLI_JS = path.join(REPO_ROOT, "node_modules/supabase/dist/supabase.js");
const CLI_BIN = path.join(REPO_ROOT, "node_modules/.bin/supabase");
const TYPES_HELPER = path.join(REPO_ROOT, "supabase-gen-types.sh");
// Relative to the disposable project root.
const CATALOG_QUERY = "supabase/verification/catalog.sql";
const CATALOG_FILE = "catalog.json";

const WORKSPACE_PREFIX = "chooselife-verify-";
const WORKSPACE_NAME = /^chooselife-verify-[A-Za-z0-9]{6}$/;
const PROJECT_ID = /^chooselife-verify-[0-9a-f]{12}$/;
const MIGRATION_FILE = /^(\d+)_.*\.sql$/;
const TEST_EXTENSIONS = new Set([".sql", ".pg"]);

// Inputs copied from supabase/. Everything else, including .temp, .branches,
// .env files and functions/, stays behind.
const INPUT_DIRECTORIES = [
  "migrations",
  "tests",
  "seeds",
  "schemas",
  "verification",
];
const INPUT_FILES = ["seed.sql"];
const REQUIRED_DIRECTORIES = ["migrations", "tests"];

// Local service sections. Every *port key in them gets a fresh port, and the
// listed keys are added when the source config relies on defaults.
const REQUIRED_PORTS = {
  api: ["port"],
  db: ["port", "shadow_port"],
  "db.pooler": ["port"],
  studio: ["port"],
  inbucket: ["port"],
  analytics: ["port"],
  edge_runtime: ["inspector_port"],
};
const DISABLED_SECTIONS = ["studio", "analytics", "edge_runtime"];

const ENV_ALLOWED = new Set([
  "PATH",
  "HOME",
  "USER",
  "LOGNAME",
  "SHELL",
  "LANG",
  "TZ",
  "CI",
  "TMPDIR",
  "TMP",
  "TEMP",
  "XDG_CONFIG_HOME",
  "XDG_CACHE_HOME",
  "XDG_DATA_HOME",
  "XDG_RUNTIME_DIR",
  "DOCKER_HOST",
  "DOCKER_CONTEXT",
  "DOCKER_CONFIG",
  "DOCKER_CERT_PATH",
  "DOCKER_TLS_VERIFY",
  "DOCKER_API_VERSION",
  "SSL_CERT_FILE",
  "SSL_CERT_DIR",
  "NODE_EXTRA_CA_CERTS",
  "HTTP_PROXY",
  "HTTPS_PROXY",
  "NO_PROXY",
  "http_proxy",
  "https_proxy",
  "no_proxy",
  "SystemRoot",
  "ComSpec",
  "PATHEXT",
  "APPDATA",
  "LOCALAPPDATA",
  "USERPROFILE",
]);

const USAGE = `Usage: pnpm db:verify [--keep] [--check-types]

Replays every migration and seed, captures the schema catalog, lints the
public schema and runs every pgTAP test in a disposable copy of the Supabase
project. Requires a running Docker-compatible runtime such as Docker Desktop,
OrbStack or Colima. The existing local stack and its data are left alone.

  --keep          Keep the disposable stack and its catalog capture, and
                  print where they are and how to remove them.
  --check-types   Also fail if types generated from the replay differ from
                  packages/database/database-generated.types.ts.`;

class VerifyError extends Error {
  constructor(message, output = "") {
    super(message);
    this.output = output;
  }
}

class UsageError extends Error {}

export function parseArgs(argv) {
  const options = { keep: false, checkTypes: false, help: false };
  for (const arg of argv) {
    if (arg === "--keep") options.keep = true;
    else if (arg === "--check-types") options.checkTypes = true;
    else if (arg === "-h" || arg === "--help") options.help = true;
    else throw new UsageError(`Unknown option: ${arg}`);
  }
  return options;
}

// Child processes get only runtime and Docker settings, never inherited
// Supabase tokens, database passwords or third-party provider credentials.
export function childEnv(env = process.env) {
  const filtered = {};
  for (const [name, value] of Object.entries(env)) {
    if (ENV_ALLOWED.has(name) || name.startsWith("LC_")) filtered[name] = value;
  }
  filtered.NO_COLOR = "1";
  return filtered;
}

export async function allocatePorts(count) {
  const servers = [];
  try {
    for (let i = 0; i < count; i++) {
      const server = net.createServer();
      servers.push(server);
      await new Promise((resolve, reject) => {
        server.once("error", reject);
        server.listen(0, "127.0.0.1", resolve);
      });
    }
    const ports = servers.map((server) => server.address().port);
    if (new Set(ports).size !== ports.length) {
      throw new VerifyError("Port allocation returned a duplicate port.");
    }
    return ports;
  } finally {
    await Promise.all(
      servers.map((server) => new Promise((resolve) => server.close(resolve))),
    );
  }
}

// Line-based rewrite of supabase/config.toml for the disposable copy. Sets the
// project ID, gives every port key a fresh port, disables Studio, analytics
// and Edge runtime, and drops [functions.*] since Edge runtime is off. Ports
// outside local service sections, such as an SMTP relay, are left alone. All
// other lines, including seed order and major_version, are kept verbatim.
export function transformConfig(source, projectId, takePort) {
  const output = [];
  const ports = {};
  const seenSections = new Set();
  let section = "";
  let sectionKeys = new Set();
  let dropping = false;
  let hasProjectId = false;

  const setPort = (key) => {
    const port = takePort();
    ports[`${section}.${key}`] = port;
    return `${key} = ${port}`;
  };
  const finishSection = () => {
    if (dropping) return;
    for (const key of REQUIRED_PORTS[section] ?? []) {
      if (!sectionKeys.has(key)) output.push(setPort(key));
    }
    if (DISABLED_SECTIONS.includes(section) && !sectionKeys.has("enabled")) {
      output.push("enabled = false");
    }
  };

  for (const line of source.split("\n")) {
    const header = /^\s*\[\[?([^\]]+)\]\]?\s*(#.*)?$/.exec(line);
    if (header) {
      finishSection();
      section = header[1].trim();
      sectionKeys = new Set();
      seenSections.add(section);
      dropping = section === "functions" || section.startsWith("functions.");
      if (!dropping) output.push(line);
      continue;
    }
    if (dropping) continue;

    const entry = /^(\s*)([A-Za-z0-9_-]+)\s*=/.exec(line);
    if (!entry) {
      output.push(line);
      continue;
    }
    const [, indent, key] = entry;
    sectionKeys.add(key);
    if (section === "" && key === "project_id") {
      hasProjectId = true;
      output.push(`${indent}project_id = "${projectId}"`);
    } else if (section in REQUIRED_PORTS && /(^|_)port$/.test(key)) {
      output.push(indent + setPort(key));
    } else if (key === "enabled" && DISABLED_SECTIONS.includes(section)) {
      output.push(`${indent}enabled = false`);
    } else {
      output.push(line);
    }
  }
  finishSection();

  for (const name of new Set([
    ...Object.keys(REQUIRED_PORTS),
    ...DISABLED_SECTIONS,
  ])) {
    if (seenSections.has(name)) continue;
    section = name;
    sectionKeys = new Set();
    output.push("", `[${name}]`);
    finishSection();
  }
  if (!hasProjectId) output.unshift(`project_id = "${projectId}"`);
  return { text: output.join("\n"), ports };
}

// Copies regular files only. Dotfiles are skipped; links and special files
// fail the run rather than silently dropping an input.
async function copyInputTree(source, destination) {
  await fs.mkdir(destination, { recursive: true });
  for (const entry of await fs.readdir(source, { withFileTypes: true })) {
    if (entry.name.startsWith(".")) continue;
    const from = path.join(source, entry.name);
    const to = path.join(destination, entry.name);
    if (entry.isDirectory()) await copyInputTree(from, to);
    else if (entry.isFile()) await fs.copyFile(from, to);
    else
      throw new VerifyError(
        `Refusing to copy ${from}: not a regular file or directory.`,
      );
  }
}

async function copyInputs(sourceDir, destinationDir) {
  for (const name of [...INPUT_DIRECTORIES, ...INPUT_FILES]) {
    const from = path.join(sourceDir, name);
    const stat = await fs.lstat(from).catch((error) => {
      if (error.code === "ENOENT") return undefined;
      throw error;
    });
    if (!stat) {
      if (REQUIRED_DIRECTORIES.includes(name)) {
        throw new VerifyError(`Missing required input ${from}.`);
      }
      continue;
    }
    const expectDirectory = INPUT_DIRECTORIES.includes(name);
    if (expectDirectory ? !stat.isDirectory() : !stat.isFile()) {
      throw new VerifyError(
        `Refusing to copy ${from}: expected a regular ${expectDirectory ? "directory" : "file"}.`,
      );
    }
    if (expectDirectory)
      await copyInputTree(from, path.join(destinationDir, name));
    else await fs.copyFile(from, path.join(destinationDir, name));
  }
}

async function listMigrationVersions(migrationsDir) {
  const versions = [];
  for (const entry of await fs.readdir(migrationsDir, {
    withFileTypes: true,
  })) {
    if (!entry.isFile() || !entry.name.endsWith(".sql")) continue;
    const match = MIGRATION_FILE.exec(entry.name);
    if (!match)
      throw new VerifyError(
        `Migration ${entry.name} does not match <version>_<name>.sql.`,
      );
    versions.push(match[1]);
  }
  if (versions.length === 0) throw new VerifyError("No migrations found.");
  return versions.sort();
}

async function listTestFiles(testsDir, relative = "") {
  const files = [];
  for (const entry of await fs.readdir(path.join(testsDir, relative), {
    withFileTypes: true,
  })) {
    const name = path.join(relative, entry.name);
    if (entry.isDirectory())
      files.push(...(await listTestFiles(testsDir, name)));
    else if (TEST_EXTENSIONS.has(path.extname(entry.name))) files.push(name);
  }
  return files.sort();
}

async function assertSeedPathsCopied(supabaseDir, config) {
  const line = /^\s*sql_paths\s*=\s*\[([^\]]*)\]/m.exec(config);
  if (!line) return;
  for (const [, seedPath] of line[1].matchAll(/['"]([^'"]+)['"]/g)) {
    const resolved = path.resolve(supabaseDir, seedPath);
    if (!resolved.startsWith(supabaseDir + path.sep)) {
      throw new VerifyError(
        `Seed path ${seedPath} is outside the Supabase directory.`,
      );
    }
    if (/[*?[]/.test(seedPath)) continue;
    await fs.access(resolved).catch(() => {
      throw new VerifyError(
        `Seed path ${seedPath} was not copied into the disposable project.`,
      );
    });
  }
}

// Creates the disposable project under the OS temp directory. Nothing runs
// against Docker here. On failure the partial directory is removed.
export async function prepareWorkspace({ repoRoot = REPO_ROOT } = {}) {
  const tmpRoot = await fs.realpath(os.tmpdir());
  const root = await fs.mkdtemp(path.join(tmpRoot, WORKSPACE_PREFIX));
  try {
    const projectId = WORKSPACE_PREFIX + randomBytes(6).toString("hex");
    const sourceDir = path.join(repoRoot, "supabase");
    const supabaseDir = path.join(root, "supabase");
    await fs.mkdir(supabaseDir);
    await copyInputs(sourceDir, supabaseDir);

    const sourceConfig = await fs.readFile(
      path.join(sourceDir, "config.toml"),
      "utf8",
    );
    let needed = 0;
    transformConfig(sourceConfig, projectId, () => ++needed);
    const pool = await allocatePorts(needed);
    const { text, ports } = transformConfig(sourceConfig, projectId, () =>
      pool.shift(),
    );
    await fs.writeFile(path.join(supabaseDir, "config.toml"), text);
    await assertSeedPathsCopied(supabaseDir, text);

    const testsDir = path.join(supabaseDir, "tests");
    const testFiles = await listTestFiles(testsDir);
    if (testFiles.length === 0)
      throw new VerifyError(
        `No SQL test files found in ${path.join(sourceDir, "tests")}.`,
      );
    const migrationVersions = await listMigrationVersions(
      path.join(supabaseDir, "migrations"),
    );

    const workspace = {
      root,
      projectId,
      ports,
      testsDir,
      testFiles,
      migrationVersions,
    };
    await assertOwnedWorkspace(workspace);
    return workspace;
  } catch (error) {
    await fs.rm(root, { recursive: true, force: true });
    throw error;
  }
}

// Every reset and cleanup goes through this check first.
export async function assertOwnedWorkspace(workspace) {
  const { root, projectId } = workspace;
  const tmpRoot = await fs.realpath(os.tmpdir());
  if (!PROJECT_ID.test(projectId ?? ""))
    throw new VerifyError(`Refusing project ID ${projectId}.`);
  if (
    typeof root !== "string" ||
    !path.isAbsolute(root) ||
    path.dirname(root) !== tmpRoot ||
    !WORKSPACE_NAME.test(path.basename(root))
  ) {
    throw new VerifyError(
      `Refusing workspace ${root}: not a verifier directory under ${tmpRoot}.`,
    );
  }
  const stat = await fs.lstat(root);
  if (
    !stat.isDirectory() ||
    (process.getuid && stat.uid !== process.getuid())
  ) {
    throw new VerifyError(
      `Refusing workspace ${root}: not a directory owned by this user.`,
    );
  }
  const config = await fs.readFile(
    path.join(root, "supabase/config.toml"),
    "utf8",
  );
  if (/^project_id\s*=\s*"([^"]*)"/m.exec(config)?.[1] !== projectId) {
    throw new VerifyError(
      `Refusing workspace ${root}: its project ID is not ${projectId}.`,
    );
  }
}

const shellQuote = (value) => `'${String(value).replaceAll("'", "'\\''")}'`;

export function describeWorkspace(workspace) {
  const root = shellQuote(workspace.root);
  return {
    path: workspace.root,
    projectId: workspace.projectId,
    ports: workspace.ports,
    ...(workspace.catalogFile && { catalog: workspace.catalogFile }),
    cleanup: `${shellQuote(CLI_BIN)} --workdir ${root} stop --project-id ${workspace.projectId} --no-backup && rm -rf ${root}`,
  };
}

// Status output prints keys, the JWT secret and connection URLs. Failure
// diagnostics pass through this before printing.
export function redact(text) {
  return text
    .replace(/eyJ[\w-]+\.[\w-]+\.[\w-]+/g, "[redacted]")
    .replace(/sb_(secret|publishable)_[\w-]+/g, "[redacted]")
    .replace(/(\w+:\/\/[^:/\s]+:)[^@\s]+@/g, "$1[redacted]@")
    .replace(
      /^(.*\b(key|secret|password|token)\s*[:=]\s*).+$/gim,
      "$1[redacted]",
    );
}

export function parsePgProveSummary(output) {
  const summary = /^Files=(\d+), Tests=(\d+),/m.exec(output);
  const result = /^Result: (\w+)\s*$/m.exec(output);
  if (!summary || !result)
    throw new VerifyError(
      "Could not find the pg_prove summary in the test output.",
    );
  return {
    files: Number(summary[1]),
    assertions: Number(summary[2]),
    result: result[1],
  };
}

let activeChild;

function run(command, args, { cwd = REPO_ROOT } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      env: childEnv(),
      stdio: ["ignore", "pipe", "pipe"],
    });
    activeChild = child;
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => (stdout += chunk));
    child.stderr.on("data", (chunk) => (stderr += chunk));
    child.on("error", reject);
    child.on("close", (code, signal) => {
      activeChild = undefined;
      resolve({ code, signal, stdout, stderr });
    });
  });
}

// Global flags pin the target project and keep output independent of TTY and
// agent detection.
function runCli(workspace, args, options) {
  const globals = [
    "--workdir",
    workspace.root,
    "--agent",
    "no",
    "--output-format",
    "text",
  ];
  return run(process.execPath, [CLI_JS, ...globals, ...args], options);
}

async function runCliStep(workspace, label, args, options) {
  const result = await runCli(workspace, args, options);
  if (result.code !== 0) {
    throw new VerifyError(
      `${label} failed (${result.signal ?? `exit ${result.code}`}).`,
      result.stderr + result.stdout,
    );
  }
  return result;
}

async function checkMigrations(workspace) {
  const sql =
    "select version from supabase_migrations.schema_migrations order by version";
  const { stdout } = await runCliStep(workspace, "Reading applied migrations", [
    "db",
    "query",
    "--local",
    "--output",
    "json",
    sql,
  ]);
  let applied;
  try {
    applied = JSON.parse(stdout)
      .map((row) => String(row.version))
      .sort();
  } catch {
    throw new VerifyError("Could not parse applied migration versions.");
  }
  const expected = workspace.migrationVersions;
  const missing = expected.filter((version) => !applied.includes(version));
  const extra = applied.filter((version) => !expected.includes(version));
  if (
    missing.length > 0 ||
    extra.length > 0 ||
    applied.length !== expected.length
  ) {
    throw new VerifyError(
      `Applied migrations differ from migration files. Missing: ${missing.join(", ") || "none"}. Unexpected: ${extra.join(", ") || "none"}.`,
    );
  }
  return `${applied.length} versions match ${expected.length} files`;
}

// Runs the copied supabase/verification/catalog.sql against the owned project
// and writes the validated payload to <root>/catalog.json, which cleanup
// removes with the rest of the project. Capture right after a reset: lint and
// pgTAP install helpers that are not part of the migrations. Query output can
// hold catalog values, so a failure reports only stderr and the checker's
// message, never stdout.
export async function captureCatalog(workspace) {
  await assertOwnedWorkspace(workspace);
  const query = path.join(workspace.root, CATALOG_QUERY);
  await fs.access(query).catch(() => {
    throw new VerifyError(`Missing the catalog query ${CATALOG_QUERY}.`);
  });
  const result = await runCli(workspace, [
    "db",
    "query",
    "--local",
    "--file",
    query,
    "--output",
    "json",
  ]);
  if (result.code !== 0) {
    throw new VerifyError(
      `Catalog query failed (${result.signal ?? `exit ${result.code}`}).`,
      result.stderr,
    );
  }
  let catalog;
  try {
    catalog = extractCatalog(result.stdout);
  } catch (error) {
    throw new VerifyError(`Catalog capture is invalid: ${error.message}`);
  }
  const file = path.join(workspace.root, CATALOG_FILE);
  const partial = `${file}.partial`;
  await fs.writeFile(partial, `${JSON.stringify(catalog)}\n`, { flag: "wx" });
  await fs.rename(partial, file);
  workspace.catalogFile = file;
  const objects = Object.values(catalog.counts).reduce((a, b) => a + b, 0);
  return `${Object.keys(catalog.counts).length} sections, ${objects} objects, ${file}`;
}

async function runTests(workspace) {
  const { stdout } = await runCliStep(
    workspace,
    "pgTAP",
    ["test", "db", "--local", workspace.testsDir],
    { cwd: workspace.root },
  );
  const summary = parsePgProveSummary(stdout);
  const expected = workspace.testFiles.length;
  if (
    summary.result !== "PASS" ||
    summary.files !== expected ||
    summary.assertions === 0
  ) {
    throw new VerifyError(
      `pgTAP reported ${summary.result} with ${summary.files} of ${expected} files and ${summary.assertions} assertions.`,
      stdout,
    );
  }
  return `${summary.files} files, ${summary.assertions} assertions`;
}

async function checkTypes(workspace) {
  const result = await run("bash", [
    TYPES_HELPER,
    "--check",
    "--workdir",
    workspace.root,
  ]);
  if (result.code === 1) {
    throw new VerifyError(
      "Generated types differ from packages/database/database-generated.types.ts. Regenerate them from a clean replay as supabase/README.md describes.",
    );
  }
  if (result.code !== 0)
    throw new VerifyError(
      `Type check failed (exit ${result.code}).`,
      result.stderr,
    );
  return "generated types match";
}

export async function cleanupWorkspace(workspace, { stopStack = true } = {}) {
  await assertOwnedWorkspace(workspace);
  if (stopStack) {
    await runCliStep(workspace, "Stopping the disposable stack", [
      "stop",
      "--project-id",
      workspace.projectId,
      "--no-backup",
    ]);
  }
  await fs.rm(workspace.root, { recursive: true, force: true });
}

const log = (message) => console.log(`[db:verify] ${message}`);

async function step(name, action) {
  log(`${name}...`);
  const detail = await action();
  log(`${name}: ok${detail ? ` (${detail})` : ""}`);
}

export async function main(argv) {
  let options;
  try {
    options = parseArgs(argv);
  } catch (error) {
    console.error(`${error.message}\n\n${USAGE}`);
    return 2;
  }
  if (options.help) {
    console.log(USAGE);
    return 0;
  }

  let interrupted;
  let cleaningUp = false;
  const onSignal = (signal) => {
    if (interrupted) return;
    interrupted = signal;
    log(`Received ${signal}; stopping.`);
    // A signal during cleanup must not kill the stop command itself.
    if (!cleaningUp) activeChild?.kill(signal);
  };
  process.on("SIGINT", onSignal);
  process.on("SIGTERM", onSignal);

  let workspace;
  let started = false;
  let status = 0;
  try {
    await fs.access(CLI_JS).catch(() => {
      throw new VerifyError(
        `Repository Supabase CLI not found at ${CLI_JS}. Run pnpm install.`,
      );
    });
    await step("Preparing disposable project", async () => {
      workspace = await prepareWorkspace();
      return `${workspace.projectId}, ${workspace.migrationVersions.length} migrations, ${workspace.testFiles.length} test files`;
    });
    const checkInterrupt = () => {
      if (interrupted) throw new VerifyError(`Interrupted by ${interrupted}.`);
    };

    checkInterrupt();
    await assertOwnedWorkspace(workspace);
    started = true;
    await step("Starting disposable stack", async () => {
      // start prints keys and the JWT secret to stdout, including table cells
      // redact cannot recognize, so a failure shows only stderr.
      const result = await runCli(workspace, ["start"]);
      if (result.code !== 0)
        throw new VerifyError(
          `supabase start (is Docker running?) failed (${result.signal ?? `exit ${result.code}`}).`,
          result.stderr,
        );
    });
    checkInterrupt();
    await assertOwnedWorkspace(workspace);
    await step("Replaying migrations and seeds", async () => {
      await runCliStep(workspace, "db reset", [
        "db",
        "reset",
        "--local",
        "--yes",
      ]);
    });
    checkInterrupt();
    await step("Comparing applied migrations", () =>
      checkMigrations(workspace),
    );
    checkInterrupt();
    await step("Capturing schema catalog", () => captureCatalog(workspace));
    checkInterrupt();
    await step("Linting public schema", async () => {
      await runCliStep(workspace, "db lint", [
        "db",
        "lint",
        "--local",
        "--schema",
        "public",
        "--level",
        "error",
        "--fail-on",
        "error",
      ]);
    });
    checkInterrupt();
    await step("Running pgTAP tests", () => runTests(workspace));
    if (options.checkTypes) {
      checkInterrupt();
      await step("Checking generated types", () => checkTypes(workspace));
    }
    checkInterrupt();
    log("Verification passed.");
  } catch (error) {
    status = interrupted ? 128 + os.constants.signals[interrupted] : 1;
    console.error(`[db:verify] ${error.message}`);
    if (error.output)
      console.error(
        redact(error.output.trimEnd().split("\n").slice(-40).join("\n")),
      );
  }

  if (workspace && options.keep) {
    log("Kept the disposable project:");
    console.log(JSON.stringify(describeWorkspace(workspace), null, 2));
  } else if (workspace) {
    cleaningUp = true;
    try {
      await cleanupWorkspace(workspace, { stopStack: started });
      log("Removed the disposable project.");
    } catch (error) {
      console.error(`[db:verify] Cleanup failed: ${error.message}`);
      if (error.output)
        console.error(
          redact(error.output.trimEnd().split("\n").slice(-20).join("\n")),
        );
      console.error(
        `[db:verify] Recover with: ${describeWorkspace(workspace).cleanup}`,
      );
      status ||= 1;
    }
  }
  process.off("SIGINT", onSignal);
  process.off("SIGTERM", onSignal);
  return status;
}

if (import.meta.main) {
  process.exitCode = await main(process.argv.slice(2));
}
