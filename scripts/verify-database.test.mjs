import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { after, before, beforeEach, test } from "node:test";

import { SECTIONS, readCatalog } from "./check-database-catalog.mjs";
import {
  assertOwnedWorkspace,
  childEnv,
  cleanupWorkspace,
  parsePgProveSummary,
  prepareWorkspace,
  redact,
  transformConfig,
} from "./verify-database.mjs";

const repoRoot = path.resolve(import.meta.dirname, "..");
const verifierPath = path.join(import.meta.dirname, "verify-database.mjs");
const checkerPath = path.join(
  import.meta.dirname,
  "check-database-catalog.mjs",
);
const SECRETS = [
  "sb_publishable_FAKEPUB",
  "sb_secret_FAKESECRET",
  "fake-jwt-secret-value",
  "hunter2",
];
const SERVICE_PORTS = [
  "api.port",
  "db.port",
  "db.shadow_port",
  "db.pooler.port",
  "studio.port",
  "inbucket.port",
  "analytics.port",
  "edge_runtime.inspector_port",
];

// Synthetic metadata only: one schema and otherwise empty sections. The
// comment is a sentinel that must never reach the verifier's output.
const CATALOG_SENTINEL = "SENTINEL_CATALOG_PAYLOAD";
const CATALOG = {
  format: "chooselife.catalog.v2",
  environment: {
    server_version_num: "150000",
    app_owner: "postgres",
    complete_visibility: true,
    extension_versions: { plpgsql: "1.0" },
  },
  counts: Object.fromEntries(
    SECTIONS.map((section) => [section, section === "schemas" ? 1 : 0]),
  ),
  ...Object.fromEntries(SECTIONS.map((section) => [section, []])),
  schemas: [
    {
      id: "public",
      owner: "pg_database_owner",
      extension_member: false,
      comment: CATALOG_SENTINEL,
      acl: ["anon:USAGE"],
      effective: { anon: ["USAGE"], authenticated: [], service_role: [] },
    },
  ],
};
const CATALOG_ROWS = JSON.stringify([{ catalog: CATALOG }]);

let base;
let tmpDir;
let fixtureCount = 0;
const originalTmpdir = process.env.TMPDIR;

// Records each call and answers from behavior.json, deriving realistic
// defaults for start, db query and test db from the disposable workdir.
const FAKE_CLI = `import fs from "node:fs";
import path from "node:path";
const dir = import.meta.dirname;
const argv = process.argv.slice(2);
const rest = [];
let workdir;
for (let i = 0; i < argv.length; i++) {
  if (["--workdir", "--agent", "--output-format"].includes(argv[i])) {
    if (argv[i] === "--workdir") workdir = argv[i + 1];
    i++;
  } else rest.push(argv[i]);
}
let command = rest[0] === "db" || rest[0] === "test" ? rest.slice(0, 2).join(" ") : rest[0];
if (command === "db query" && rest.includes("--file")) command = "db query --file";
fs.appendFileSync(path.join(dir, "calls.log"), JSON.stringify({ argv, rest, command, cwd: process.cwd(), env: process.env }) + "\\n");
const behavior = JSON.parse(fs.readFileSync(path.join(dir, "behavior.json"), "utf8"))[command] ?? {};
if (behavior.sleepMs) await new Promise((resolve) => setTimeout(resolve, behavior.sleepMs));
let stdout = behavior.stdout;
if (stdout === undefined && command === "start") {
  stdout = "API URL: http://127.0.0.1:1\\nPublishable key: sb_publishable_FAKEPUB\\nSecret key: sb_secret_FAKESECRET\\nJWT secret: fake-jwt-secret-value\\n";
}
if (stdout === undefined && command === "db query") {
  const versions = fs.readdirSync(path.join(workdir, "supabase/migrations")).map((name) => name.split("_")[0]);
  stdout = JSON.stringify(versions.map((version) => ({ version })), null, 2) + "\\n";
}
if (stdout === undefined && command === "db query --file") {
  stdout = ${JSON.stringify(CATALOG_ROWS)} + "\\n";
}
if (stdout === undefined && command === "test db") {
  const count = fs.readdirSync(rest.at(-1), { recursive: true }).filter((name) => /\\.(sql|pg)$/.test(name)).length;
  stdout = "a_test.sql .. ok\\nAll tests successful.\\nFiles=" + count + ", Tests=7,  1 wallclock secs\\nResult: PASS\\n";
}
process.stdout.write(stdout ?? "");
process.stderr.write(behavior.stderr ?? "");
process.exitCode = behavior.code ?? 0;
`;

const FAKE_TYPES_HELPER = `#!/bin/bash
echo "$@" >> "$(dirname "$0")/gen-types.log"
exit "$(cat "$(dirname "$0")/gen-types.status")"
`;

async function writeFile(file, content) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, content);
}

async function makeFixture(mutate) {
  const root = path.join(base, `fixture-${++fixtureCount}`);
  const supabase = path.join(root, "supabase");
  await writeFile(
    path.join(root, "scripts/verify-database.mjs"),
    await fs.readFile(verifierPath),
  );
  await writeFile(
    path.join(root, "scripts/check-database-catalog.mjs"),
    await fs.readFile(checkerPath),
  );
  await writeFile(
    path.join(root, "node_modules/supabase/dist/supabase.js"),
    FAKE_CLI,
  );
  await writeFile(
    path.join(root, "node_modules/supabase/dist/behavior.json"),
    "{}",
  );
  await writeFile(path.join(root, "supabase-gen-types.sh"), FAKE_TYPES_HELPER);
  await writeFile(path.join(root, "gen-types.status"), "0");
  await writeFile(
    path.join(supabase, "config.toml"),
    await fs.readFile(path.join(repoRoot, "supabase/config.toml")),
  );
  await writeFile(
    path.join(supabase, "migrations/20250101000000_init.sql"),
    "create table a ();\n",
  );
  await writeFile(
    path.join(supabase, "migrations/20250102000000_more.sql.sql"),
    "create table b ();\n",
  );
  await writeFile(
    path.join(supabase, "tests/a_test.sql"),
    "begin; select * from no_plan(); select * from finish(); rollback;\n",
  );
  await writeFile(path.join(supabase, "tests/nested/b_test.pg"), "select 1;\n");
  await writeFile(path.join(supabase, "tests/README.md"), "notes\n");
  await writeFile(path.join(supabase, "tests/.env"), "SECRET=1\n");
  await writeFile(path.join(supabase, "seed.sql"), "-- seed\n");
  await writeFile(
    path.join(supabase, "verification/catalog.sql"),
    "select 1 as catalog;\n",
  );
  await writeFile(
    path.join(supabase, "seeds/association-billing-personas.sql"),
    "-- personas\n",
  );
  await writeFile(
    path.join(supabase, ".env"),
    "SUPABASE_AUTH_EXTERNAL_APPLE_SECRET=leak\n",
  );
  await writeFile(
    path.join(supabase, ".temp/project-ref"),
    "abcdefghijklmnop\n",
  );
  await writeFile(path.join(supabase, ".branches/_current_branch"), "main\n");
  await writeFile(
    path.join(supabase, "functions/push-notification/index.ts"),
    "export {};\n",
  );
  await writeFile(path.join(supabase, "scripts/one-off.sql"), "select 1;\n");
  await fs.symlink(
    path.join(supabase, "seed.sql"),
    path.join(supabase, "linked-seed.sql"),
  );
  if (mutate) await mutate(supabase, root);
  return root;
}

async function setBehavior(root, behavior) {
  await fs.writeFile(
    path.join(root, "node_modules/supabase/dist/behavior.json"),
    JSON.stringify(behavior),
  );
}

async function readCalls(root) {
  const log = await fs
    .readFile(path.join(root, "node_modules/supabase/dist/calls.log"), "utf8")
    .catch(() => "");
  return log
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

function runVerifier(root, args, { onSpawn } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      [path.join(root, "scripts/verify-database.mjs"), ...args],
      {
        cwd: root,
        env: {
          ...process.env,
          TMPDIR: tmpDir,
          SUPABASE_ACCESS_TOKEN: "sbp_leak",
          SUPABASE_DB_PASSWORD: "hunter2",
          SUPABASE_PROJECT_ID: "abcdefghijklmnop",
          SUPABASE_CLI_BINARY_OVERRIDE: "/nonexistent",
          OPENAI_API_KEY: "sk-leak",
          AWS_SECRET_ACCESS_KEY: "leak",
          DOCKER_HOST: "unix:///tmp/docker.sock",
        },
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => (stdout += chunk));
    child.stderr.on("data", (chunk) => (stderr += chunk));
    child.on("error", reject);
    child.on("close", (code, signal) =>
      resolve({ code, signal, stdout, stderr, output: stdout + stderr }),
    );
    onSpawn?.(child);
  });
}

const tmpEntries = () => fs.readdir(tmpDir);
const projectIdFrom = (stdout) =>
  /\((chooselife-verify-[0-9a-f]{12}),/.exec(stdout)?.[1];

function sectionValue(text, section, key) {
  let current = "";
  for (const line of text.split("\n")) {
    const header = /^\[([^\]]+)\]/.exec(line);
    if (header) current = header[1];
    const entry = /^([A-Za-z0-9_-]+)\s*=\s*(.*)$/.exec(line);
    if (entry && current === section && entry[1] === key) return entry[2];
  }
  return undefined;
}

async function listTree(dir, relative = "") {
  const entries = [];
  for (const entry of await fs.readdir(path.join(dir, relative), {
    withFileTypes: true,
  })) {
    const name = path.join(relative, entry.name);
    assert.ok(
      entry.isFile() || entry.isDirectory(),
      `${name} is not a regular file or directory`,
    );
    entries.push(name);
    if (entry.isDirectory()) entries.push(...(await listTree(dir, name)));
  }
  return entries.sort();
}

before(async () => {
  base = await fs.realpath(
    await fs.mkdtemp(path.join(os.tmpdir(), "verify-database-test-")),
  );
});

beforeEach(async () => {
  tmpDir = path.join(base, `tmp-${++fixtureCount}`);
  await fs.mkdir(tmpDir);
  process.env.TMPDIR = tmpDir;
});

after(async () => {
  if (originalTmpdir === undefined) delete process.env.TMPDIR;
  else process.env.TMPDIR = originalTmpdir;
  await fs.rm(base, { recursive: true, force: true });
});

test("importing the module has no side effects", async () => {
  const result = await new Promise((resolve) => {
    const child = spawn(
      process.execPath,
      [
        "--input-type=module",
        "-e",
        `await import(${JSON.stringify(verifierPath)});`,
      ],
      {
        env: { ...process.env, TMPDIR: tmpDir },
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    let output = "";
    child.stdout.on("data", (chunk) => (output += chunk));
    child.stderr.on("data", (chunk) => (output += chunk));
    child.on("close", (code) => resolve({ code, output }));
  });
  assert.equal(result.code, 0);
  assert.equal(result.output, "");
  assert.deepEqual(await tmpEntries(), []);
});

test("the workspace copies only Supabase inputs and isolates the config", async () => {
  const fixture = await makeFixture();
  const sourceConfig = await fs.readFile(
    path.join(fixture, "supabase/config.toml"),
    "utf8",
  );
  const workspace = await prepareWorkspace({ repoRoot: fixture });
  try {
    assert.equal(path.dirname(workspace.root), tmpDir);
    assert.match(workspace.projectId, /^chooselife-verify-[0-9a-f]{12}$/);
    assert.deepEqual(workspace.migrationVersions, [
      "20250101000000",
      "20250102000000",
    ]);
    assert.deepEqual(workspace.testFiles, [
      "a_test.sql",
      path.join("nested", "b_test.pg"),
    ]);
    assert.equal(
      workspace.testsDir,
      path.join(workspace.root, "supabase/tests"),
    );

    assert.deepEqual(await listTree(workspace.root), [
      "supabase",
      "supabase/config.toml",
      "supabase/migrations",
      "supabase/migrations/20250101000000_init.sql",
      "supabase/migrations/20250102000000_more.sql.sql",
      "supabase/seed.sql",
      "supabase/seeds",
      "supabase/seeds/association-billing-personas.sql",
      "supabase/tests",
      "supabase/tests/README.md",
      "supabase/tests/a_test.sql",
      "supabase/tests/nested",
      "supabase/tests/nested/b_test.pg",
      "supabase/verification",
      "supabase/verification/catalog.sql",
    ]);

    const config = await fs.readFile(
      path.join(workspace.root, "supabase/config.toml"),
      "utf8",
    );
    assert.equal(
      sectionValue(config, "", "project_id"),
      `"${workspace.projectId}"`,
    );
    for (const [section, key] of [
      ["db.seed", "sql_paths"],
      ["db.seed", "enabled"],
      ["db", "major_version"],
      ["auth", "site_url"],
      ["auth", "jwt_expiry"],
      ["auth.external.apple", "enabled"],
    ]) {
      assert.equal(
        sectionValue(config, section, key),
        sectionValue(sourceConfig, section, key),
        `${section}.${key}`,
      );
    }
    assert.equal(
      sectionValue(config, "db.seed", "sql_paths"),
      "['./seed.sql', './seeds/association-billing-personas.sql']",
    );
    for (const section of ["api", "realtime", "storage", "auth", "inbucket"]) {
      assert.equal(sectionValue(config, section, "enabled"), "true", section);
    }
    for (const section of ["studio", "analytics", "edge_runtime"]) {
      assert.equal(sectionValue(config, section, "enabled"), "false", section);
    }
    assert.doesNotMatch(config, /^\[functions/m);

    assert.deepEqual(
      Object.keys(workspace.ports).sort(),
      [...SERVICE_PORTS].sort(),
    );
    const ports = Object.values(workspace.ports);
    assert.equal(new Set(ports).size, ports.length);
    for (const [name, port] of Object.entries(workspace.ports)) {
      const [section, key] = [
        name.slice(0, name.lastIndexOf(".")),
        name.slice(name.lastIndexOf(".") + 1),
      ];
      assert.equal(sectionValue(config, section, key), String(port), name);
      assert.notEqual(
        sectionValue(sourceConfig, section, key),
        String(port),
        name,
      );
    }
  } finally {
    await cleanupWorkspace(workspace, { stopStack: false });
  }
  assert.deepEqual(await tmpEntries(), []);
});

test("transformConfig adds default ports and leaves non-service ports alone", () => {
  const source =
    'project_id = "chooselife"\n\n[db]\nport = 1\nmajor_version = 15\n\n[auth.email.smtp]\nport = 587\n';
  let next = 60000;
  const { text, ports } = transformConfig(
    source,
    "chooselife-verify-000000000000",
    () => next++,
  );
  assert.deepEqual(Object.keys(ports).sort(), [...SERVICE_PORTS].sort());
  assert.equal(new Set(Object.values(ports)).size, SERVICE_PORTS.length);
  assert.equal(sectionValue(text, "db", "major_version"), "15");
  assert.equal(
    sectionValue(text, "db", "shadow_port"),
    String(ports["db.shadow_port"]),
  );
  assert.equal(sectionValue(text, "auth.email.smtp", "port"), "587");
  for (const section of ["studio", "analytics", "edge_runtime"]) {
    assert.equal(sectionValue(text, section, "enabled"), "false", section);
  }
});

test("workspace preparation rejects unsafe or incomplete inputs and leaves nothing behind", async (t) => {
  const cases = [
    [
      "a linked test file",
      (s) =>
        fs.symlink(
          path.join(s, "tests/a_test.sql"),
          path.join(s, "tests/linked_test.sql"),
        ),
      /Refusing to copy/,
    ],
    [
      "a linked seeds directory",
      async (s) => {
        await fs.rename(path.join(s, "seeds"), path.join(s, "real-seeds"));
        await fs.symlink(path.join(s, "real-seeds"), path.join(s, "seeds"));
      },
      /expected a regular directory/,
    ],
    [
      "no SQL tests",
      (s) =>
        fs
          .rm(path.join(s, "tests/a_test.sql"))
          .then(() => fs.rm(path.join(s, "tests/nested"), { recursive: true })),
      /No SQL test files/,
    ],
    [
      "a misnamed migration",
      (s) => fs.writeFile(path.join(s, "migrations/init.sql"), ""),
      /does not match/,
    ],
    [
      "no migrations",
      async (s) => {
        await fs.rm(path.join(s, "migrations"), { recursive: true });
        await fs.mkdir(path.join(s, "migrations"));
      },
      /No migrations found/,
    ],
    [
      "a missing seed file",
      (s) => fs.rm(path.join(s, "seeds/association-billing-personas.sql")),
      /was not copied/,
    ],
    [
      "a multi-line seed list naming a missing file",
      async (s) => {
        const config = path.join(s, "config.toml");
        const text = await fs.readFile(config, "utf8");
        await fs.writeFile(
          config,
          text.replace(
            /^sql_paths = .*$/m,
            "sql_paths = [\n  './seed.sql',\n  './seeds/missing.sql',\n]",
          ),
        );
      },
      /seeds\/missing\.sql was not copied/,
    ],
    [
      "a missing tests directory",
      (s) => fs.rm(path.join(s, "tests"), { recursive: true }),
      /Missing required input/,
    ],
  ];
  for (const [name, mutate, message] of cases) {
    await t.test(name, async () => {
      const fixture = await makeFixture(mutate);
      await assert.rejects(prepareWorkspace({ repoRoot: fixture }), message);
      assert.deepEqual(await tmpEntries(), []);
    });
  }
});

test("ownership checks refuse anything but the owned workspace", async () => {
  const fixture = await makeFixture();
  const workspace = await prepareWorkspace({ repoRoot: fixture });
  const decoy = path.join(tmpDir, "chooselife-verify-decoy1");
  await fs.symlink(workspace.root, decoy);
  const strangerDir = await fs.mkdtemp(path.join(tmpDir, "someone-else-"));
  try {
    const refused = [
      { ...workspace, projectId: "chooselife-verify-ffffffffffff" },
      { ...workspace, projectId: "chooselife" },
      { ...workspace, root: fixture },
      { ...workspace, root: strangerDir },
      { ...workspace, root: decoy },
      { ...workspace, root: path.join(workspace.root, "supabase") },
      { ...workspace, root: "relative/chooselife-verify-abcdef" },
    ];
    for (const candidate of refused) {
      await assert.rejects(
        assertOwnedWorkspace(candidate),
        /Refusing/,
        JSON.stringify(candidate.root),
      );
      await assert.rejects(
        cleanupWorkspace(candidate, { stopStack: false }),
        /Refusing/,
      );
    }
    await fs.access(path.join(workspace.root, "supabase/config.toml"));
    await fs.access(path.join(fixture, "supabase/config.toml"));
    await fs.access(strangerDir);
  } finally {
    await cleanupWorkspace(workspace, { stopStack: false });
  }
});

test("child processes receive runtime settings but no credentials", () => {
  const env = childEnv({
    PATH: "/bin",
    HOME: "/home/me",
    TMPDIR: "/tmp",
    LC_ALL: "C",
    DOCKER_HOST: "unix:///docker.sock",
    DOCKER_CONTEXT: "orbstack",
    SUPABASE_ACCESS_TOKEN: "sbp_x",
    SUPABASE_DB_PASSWORD: "x",
    SUPABASE_PROJECT_ID: "x",
    SUPABASE_CLI_BINARY_OVERRIDE: "/x",
    SUPABASE_AUTH_EXTERNAL_APPLE_SECRET: "x",
    OPENAI_API_KEY: "x",
    AWS_SECRET_ACCESS_KEY: "x",
    S3_SECRET_KEY: "x",
    DOCKER_PASSWORD: "x",
    GITHUB_TOKEN: "x",
  });
  assert.deepEqual(env, {
    PATH: "/bin",
    HOME: "/home/me",
    TMPDIR: "/tmp",
    LC_ALL: "C",
    DOCKER_HOST: "unix:///docker.sock",
    DOCKER_CONTEXT: "orbstack",
    NO_COLOR: "1",
  });
});

test("pg_prove summaries must be present and parseable", () => {
  assert.deepEqual(
    parsePgProveSummary(
      "t.sql .. ok\nAll tests successful.\nFiles=12, Tests=345,  3 wallclock secs\nResult: PASS\n",
    ),
    {
      files: 12,
      assertions: 345,
      result: "PASS",
    },
  );
  assert.throws(() => parsePgProveSummary(""), /Could not find/);
  assert.throws(() => parsePgProveSummary("Result: PASS\n"), /Could not find/);
  assert.throws(
    () => parsePgProveSummary("Files=1, Tests=1, 0 wallclock secs\n"),
    /Could not find/,
  );
});

test("redact hides keys, secrets and URL passwords", () => {
  const text = redact(
    "Publishable key: sb_publishable_FAKEPUB\nS3 Secret Key: abc123\nJWT secret: fake-jwt-secret-value\nDB URL: postgresql://postgres:hunter2@127.0.0.1:5/postgres\ntoken eyJa.eyJb.c\nport is already allocated",
  );
  for (const secret of [...SECRETS, "abc123", "eyJa.eyJb.c"])
    assert.doesNotMatch(text, new RegExp(secret));
  assert.match(text, /port is already allocated/);
  assert.match(text, /postgresql:\/\/postgres:\[redacted\]@127\.0\.0\.1/);
});

test("invalid arguments fail before any workspace or CLI call", async () => {
  const fixture = await makeFixture();
  for (const args of [
    ["--bogus"],
    ["--linked"],
    ["--workdir", "/tmp"],
    ["--keep", "--db-url=x"],
  ]) {
    const result = await runVerifier(fixture, args);
    assert.equal(result.code, 2, args.join(" "));
    assert.match(result.stderr, /Usage: pnpm db:verify/);
  }
  assert.deepEqual(await readCalls(fixture), []);
  assert.deepEqual(await tmpEntries(), []);

  const help = await runVerifier(fixture, ["--help"]);
  assert.equal(help.code, 0);
  assert.match(help.stdout, /Docker/);
  assert.deepEqual(await readCalls(fixture), []);
});

test("a passing run hard-targets the owned project and removes it", async () => {
  const fixture = await makeFixture();
  const result = await runVerifier(fixture, []);
  assert.equal(result.code, 0, result.output);
  assert.match(result.stdout, /Verification passed/);
  assert.match(
    result.stdout,
    /Running pgTAP tests: ok \(2 files, 7 assertions\)/,
  );
  assert.match(
    result.stdout,
    /Comparing applied migrations: ok \(2 versions match 2 files\)/,
  );
  for (const secret of SECRETS)
    assert.ok(!result.output.includes(secret), secret);

  const projectId = projectIdFrom(result.stdout);
  const calls = await readCalls(fixture);
  assert.deepEqual(
    calls.map((call) => call.command),
    [
      "start",
      "db reset",
      "db query",
      "db query --file",
      "db lint",
      "test db",
      "stop",
    ],
  );
  const root = calls[0].argv[1];
  assert.equal(path.dirname(root), tmpDir);
  assert.match(path.basename(root), /^chooselife-verify-/);
  for (const call of calls) {
    assert.deepEqual(call.argv.slice(0, 6), [
      "--workdir",
      root,
      "--agent",
      "no",
      "--output-format",
      "text",
    ]);
    for (const flag of ["--all", "--linked", "--db-url", "--project-ref"])
      assert.ok(!call.argv.includes(flag), flag);
    for (const name of [
      "SUPABASE_ACCESS_TOKEN",
      "SUPABASE_DB_PASSWORD",
      "SUPABASE_PROJECT_ID",
      "SUPABASE_CLI_BINARY_OVERRIDE",
      "OPENAI_API_KEY",
      "AWS_SECRET_ACCESS_KEY",
    ]) {
      assert.ok(!(name in call.env), name);
    }
    assert.equal(call.env.DOCKER_HOST, "unix:///tmp/docker.sock");
    assert.equal(call.env.NO_COLOR, "1");
  }
  const byCommand = Object.fromEntries(
    calls.map((call) => [call.command, call]),
  );
  assert.deepEqual(byCommand["start"].rest, ["start"]);
  assert.deepEqual(byCommand["db reset"].rest, [
    "db",
    "reset",
    "--local",
    "--yes",
  ]);
  assert.deepEqual(byCommand["db lint"].rest, [
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
  assert.deepEqual(byCommand["db query"].rest.slice(0, 5), [
    "db",
    "query",
    "--local",
    "--output",
    "json",
  ]);
  assert.match(
    byCommand["db query"].rest[5],
    /^select version from supabase_migrations\.schema_migrations/,
  );
  assert.deepEqual(byCommand["db query --file"].rest, [
    "db",
    "query",
    "--local",
    "--file",
    path.join(root, "supabase/verification/catalog.sql"),
    "--output",
    "json",
  ]);
  assert.match(
    result.stdout,
    /Capturing schema catalog: ok \(17 sections, 1 objects, /,
  );
  assert.ok(!result.output.includes(CATALOG_SENTINEL));
  assert.deepEqual(byCommand["test db"].rest, [
    "test",
    "db",
    "--local",
    path.join(root, "supabase/tests"),
  ]);
  assert.equal(byCommand["test db"].cwd, root);
  assert.deepEqual(byCommand["stop"].rest, [
    "stop",
    "--project-id",
    projectId,
    "--no-backup",
  ]);
  assert.deepEqual(await tmpEntries(), []);
});

test("verification failures exit 1 and still remove the owned project", async (t) => {
  const tap = (files, tests, result = "PASS") =>
    `Files=${files}, Tests=${tests},  1 wallclock secs\nResult: ${result}\n`;
  const cases = [
    [
      "start fails",
      {
        start: {
          code: 1,
          stderr:
            "Error: port is already allocated\nSecret key: sb_secret_FAKESECRET\n",
          stdout:
            "JWT secret: fake-jwt-secret-value\nDB URL: postgresql://postgres:hunter2@127.0.0.1:1/postgres\n",
        },
      },
      /port is already allocated/,
    ],
    [
      "reset fails",
      { "db reset": { code: 1, stderr: "ERROR: relation does not exist\n" } },
      /db reset failed/,
    ],
    [
      "applied migrations differ",
      { "db query": { stdout: '[{"version":"20250101000000"}]' } },
      /Missing: 20250102000000/,
    ],
    [
      "applied migrations are unparseable",
      { "db query": { stdout: "version\n-------\n" } },
      /Could not parse applied migration versions/,
    ],
    [
      "lint fails",
      {
        "db lint": {
          code: 1,
          stdout: "ERROR: function public.f has a type error\n",
        },
      },
      /db lint failed/,
    ],
    [
      "a test fails",
      {
        "test db": {
          code: 1,
          stdout: "not ok 1 - outsider cannot read\n" + tap(2, 7, "FAIL"),
        },
      },
      /pgTAP failed/,
    ],
    [
      "zero assertions run",
      { "test db": { stdout: tap(2, 0) } },
      /0 assertions/,
    ],
    [
      "fewer test files run",
      { "test db": { stdout: tap(1, 7) } },
      /1 of 2 files/,
    ],
    [
      "test output is unparseable",
      { "test db": { stdout: "all good\n" } },
      /Could not find the pg_prove summary/,
    ],
  ];
  for (const [name, behavior, message] of cases) {
    await t.test(name, async () => {
      const fixture = await makeFixture();
      await setBehavior(fixture, behavior);
      const result = await runVerifier(fixture, []);
      assert.equal(result.code, 1, result.output);
      assert.match(result.stderr, message);
      for (const secret of SECRETS)
        assert.ok(!result.output.includes(secret), secret);
      const calls = await readCalls(fixture);
      assert.equal(calls.at(-1).command, "stop");
      assert.deepEqual(await tmpEntries(), []);
    });
  }
});

test("a start failure prints its stderr but none of its credential stdout", async () => {
  const sentinels = [
    "SENTINEL_UNICODE_PUBLISHABLE",
    "SENTINEL_UNICODE_SECRET",
    "SENTINEL_UNICODE_JWT",
    "SENTINEL_S3_ACCESS",
    "SENTINEL_S3_SECRET",
    "SENTINEL_ASCII_SECRET",
    "SENTINEL_ASCII_JWT",
    "SENTINEL_PLAIN",
    "SENTINEL_STDERR",
  ];
  const stdout = [
    "╭───────────────────────────────────────────╮",
    "│ 🔑 Authentication Keys                    │",
    "├─────────────┬─────────────────────────────┤",
    "│ Publishable │ SENTINEL_UNICODE_PUBLISHABLE │",
    "│ Secret      │ SENTINEL_UNICODE_SECRET      │",
    "│ JWT Secret  │ SENTINEL_UNICODE_JWT         │",
    "╰─────────────┴─────────────────────────────╯",
    "┌────────────┬────────────────────┐",
    "│ Access Key │ SENTINEL_S3_ACCESS │",
    "│ Secret Key │ SENTINEL_S3_SECRET │",
    "└────────────┴────────────────────┘",
    "+------------+-----------------------+",
    "| Secret Key | SENTINEL_ASCII_SECRET |",
    "| JWT Secret | SENTINEL_ASCII_JWT    |",
    "+------------+-----------------------+",
    "SENTINEL_PLAIN",
    "",
  ].join("\n");
  // The table cells are the gap: redact alone would let them through.
  assert.ok(sentinels.some((value) => redact(stdout).includes(value)));

  const fixture = await makeFixture();
  await setBehavior(fixture, {
    start: {
      code: 1,
      stdout,
      stderr:
        "failed to start docker container: Ports are not available: exposing port TCP 127.0.0.1:54321\nJWT secret: SENTINEL_STDERR\n",
    },
  });
  const result = await runVerifier(fixture, []);
  assert.equal(result.code, 1, result.output);
  assert.match(
    result.stderr,
    /supabase start \(is Docker running\?\) failed \(exit 1\)/,
  );
  assert.match(result.stderr, /Ports are not available: exposing port TCP/);
  for (const value of sentinels)
    assert.ok(!result.output.includes(value), value);
  assert.deepEqual(
    (await readCalls(fixture)).map((call) => call.command),
    ["start", "stop"],
  );
  assert.deepEqual(await tmpEntries(), []);
  for (const kept of [
    "supabase/config.toml",
    "supabase/migrations/20250101000000_init.sql",
    "supabase/.temp/project-ref",
  ])
    await fs.access(path.join(fixture, kept));
});

test("a failed cleanup keeps the primary exit code and prints recovery steps", async (t) => {
  for (const [name, behavior] of [
    [
      "after a test failure",
      {
        "test db": { code: 1, stdout: "not ok 1\n" },
        stop: { code: 1, stderr: "cannot connect to Docker\n" },
      },
    ],
    [
      "after a passing run",
      { stop: { code: 1, stderr: "cannot connect to Docker\n" } },
    ],
  ]) {
    await t.test(name, async () => {
      const fixture = await makeFixture();
      await setBehavior(fixture, behavior);
      const result = await runVerifier(fixture, []);
      assert.equal(result.code, 1, result.output);
      const projectId = projectIdFrom(result.stdout);
      const [kept] = await tmpEntries();
      assert.match(
        result.stderr,
        /Cleanup failed: Stopping the disposable stack failed/,
      );
      assert.ok(result.stderr.includes(`Recover with: `));
      assert.ok(
        result.stderr.includes(
          `stop --project-id ${projectId} --no-backup && rm -rf '${path.join(tmpDir, kept)}'`,
        ),
      );
    });
  }
});

test("--keep retains the owned project and prints a descriptor without credentials", async () => {
  const fixture = await makeFixture();
  const result = await runVerifier(fixture, ["--keep"]);
  assert.equal(result.code, 0, result.output);
  for (const secret of SECRETS)
    assert.ok(!result.output.includes(secret), secret);
  assert.ok(
    !(await readCalls(fixture)).some((call) => call.command === "stop"),
  );

  const descriptor = JSON.parse(
    result.stdout.slice(
      result.stdout.indexOf(
        "{",
        result.stdout.indexOf("Kept the disposable project"),
      ),
    ),
  );
  assert.deepEqual(Object.keys(descriptor).sort(), [
    "catalog",
    "cleanup",
    "path",
    "ports",
    "projectId",
  ]);
  assert.equal(descriptor.catalog, path.join(descriptor.path, "catalog.json"));
  assert.deepEqual(await readCatalog(descriptor.catalog), CATALOG);
  assert.ok(!result.output.includes(CATALOG_SENTINEL));
  assert.equal(path.dirname(descriptor.path), tmpDir);
  assert.equal(descriptor.projectId, projectIdFrom(result.stdout));
  assert.deepEqual(
    Object.keys(descriptor.ports).sort(),
    [...SERVICE_PORTS].sort(),
  );
  assert.ok(
    descriptor.cleanup.includes(
      `--workdir '${descriptor.path}' stop --project-id ${descriptor.projectId} --no-backup && rm -rf '${descriptor.path}'`,
    ),
  );
  await assertOwnedWorkspace({
    root: descriptor.path,
    projectId: descriptor.projectId,
  });
  await cleanupWorkspace(
    { root: descriptor.path, projectId: descriptor.projectId },
    { stopStack: false },
  );
});

test("a failed or invalid catalog capture fails before lint and pgTAP and leaves nothing behind", async (t) => {
  const rows = CATALOG_ROWS;
  const missingSection = { ...CATALOG };
  delete missingSection.storage_buckets;
  const cases = [
    [
      "the query fails after printing part of the payload",
      {
        "db query --file": {
          code: 1,
          stdout: rows.slice(0, rows.indexOf(CATALOG_SENTINEL) + 40),
          stderr:
            "ERROR: canceling statement\nSecret key: sb_secret_FAKESECRET\n",
        },
      },
      /Catalog query failed \(exit 1\)[^]*canceling statement/,
    ],
    [
      "the payload is truncated",
      { "db query --file": { stdout: rows.slice(0, -40) } },
      /Catalog capture is invalid: Input is not valid JSON/,
    ],
    [
      "the output is not a catalog",
      { "db query --file": { stdout: '[{"catalog":{"format":"other"}}]' } },
      /Catalog capture is invalid: Input is not a chooselife\.catalog\.v2 catalog/,
    ],
    [
      "a section is missing",
      {
        "db query --file": {
          stdout: JSON.stringify([{ catalog: missingSection }]),
        },
      },
      /Catalog capture is invalid: Catalog section storage_buckets is missing/,
    ],
    [
      "the query file is missing",
      {},
      /Missing the catalog query supabase\/verification\/catalog\.sql/,
      (s) => fs.rm(path.join(s, "verification"), { recursive: true }),
    ],
  ];
  for (const [name, behavior, message, mutate] of cases) {
    await t.test(name, async () => {
      const fixture = await makeFixture(mutate);
      await setBehavior(fixture, behavior);
      const result = await runVerifier(fixture, ["--check-types"]);
      assert.equal(result.code, 1, result.output);
      assert.match(result.stderr, message);
      assert.ok(!result.output.includes(CATALOG_SENTINEL));
      for (const secret of SECRETS)
        assert.ok(!result.output.includes(secret), secret);
      const commands = (await readCalls(fixture)).map((call) => call.command);
      assert.deepEqual(commands.slice(-1), ["stop"]);
      for (const skipped of ["db lint", "test db"])
        assert.ok(!commands.includes(skipped), skipped);
      await assert.rejects(fs.access(path.join(fixture, "gen-types.log")));
      assert.deepEqual(await tmpEntries(), []);
    });
  }
});

test("--check-types runs the generator in check mode against the owned project", async (t) => {
  for (const [status, code, message] of [
    ["0", 0, /Checking generated types: ok/],
    [
      "1",
      1,
      /Generated types differ from .*Regenerate them from a clean replay/,
    ],
  ]) {
    await t.test(`generator exit ${status}`, async () => {
      const fixture = await makeFixture();
      await fs.writeFile(path.join(fixture, "gen-types.status"), status);
      const result = await runVerifier(fixture, ["--check-types"]);
      assert.equal(result.code, code, result.output);
      assert.match(result.output, message);
      const root = (await readCalls(fixture))[0].argv[1];
      assert.equal(
        (await fs.readFile(path.join(fixture, "gen-types.log"), "utf8")).trim(),
        `--check --workdir ${root}`,
      );
      assert.deepEqual(await tmpEntries(), []);
    });
  }

  const fixture = await makeFixture();
  const result = await runVerifier(fixture, []);
  assert.equal(result.code, 0, result.output);
  await assert.rejects(fs.access(path.join(fixture, "gen-types.log")));
});

test("SIGTERM stops the owned project without killing its cleanup", async (t) => {
  const cases = [
    ["during startup", "start", 143, ["start", "stop"]],
    [
      "during cleanup",
      "stop",
      0,
      [
        "start",
        "db reset",
        "db query",
        "db query --file",
        "db lint",
        "test db",
        "stop",
      ],
    ],
  ];
  for (const [name, command, code, commands] of cases) {
    await t.test(name, async () => {
      const fixture = await makeFixture();
      await setBehavior(fixture, { [command]: { sleepMs: 500 } });
      const result = await runVerifier(fixture, [], {
        onSpawn: async (child) => {
          while (
            !(await readCalls(fixture)).some((call) => call.command === command)
          ) {
            await new Promise((resolve) => setTimeout(resolve, 25));
          }
          child.kill("SIGTERM");
        },
      });
      assert.equal(result.code, code, result.output);
      assert.match(result.stdout, /Received SIGTERM/);
      assert.deepEqual(
        (await readCalls(fixture)).map((call) => call.command),
        commands,
      );
      assert.deepEqual(await tmpEntries(), []);
    });
  }
});
