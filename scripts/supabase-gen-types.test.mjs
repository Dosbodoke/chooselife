import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";

const repoRoot = path.resolve(import.meta.dirname, "..");
const ARTIFACT = "packages/database/database-generated.types.ts";
const repoPrettier = fs.realpathSync(
  path.join(repoRoot, "node_modules/.bin/prettier"),
);

// Shaped like the pinned CLI output: trailing whitespace, missing semicolons
// and double quotes that a conflicting Prettier config would rewrite.
const RAW_TYPES = `export type Json =
  | string
  | number
export type Database = {
  public: {
    Tables: {
      highline: {
        Row: { id: string; name: string }
      }
    }
    Enums: { language: "en" | "pt" }
  }
}
export const Constants = {
  public: { Enums: { language: ["en", "pt"] } },
} as const
`;
const CONFLICTING_CONFIG = JSON.stringify({ singleQuote: true, tabWidth: 4 });
const PRIOR_ARTIFACT = "// prior artifact bytes\n";

// Prints the canned output after recording its arguments, then exits with the
// fixture's code, so a nonzero exit can follow complete valid output.
const FAKE_CLI = `#!/bin/bash
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
echo "$@" >> "$ROOT/cli.log"
cat "$ROOT/cli-output.ts"
exit "$(cat "$ROOT/cli-status")"
`;

// Consumes its input and prints a valid-looking partial result before failing.
const FAILING_PRETTIER = `#!/bin/bash
cat > /dev/null
echo "export type Database = {}"
echo "[error] fake formatter failure" >&2
exit 2
`;

let base;
let fixtureCount = 0;

before(() => {
  base = fs.mkdtempSync(path.join(os.tmpdir(), "chooselife-gen-types-test-"));
});

after(() => {
  fs.rmSync(base, { recursive: true, force: true });
});

// A copy of the real helper with fake CLI/formatter executables beside it, so
// REPO_ROOT resolves to the fixture and nothing touches this checkout.
function createFixture({
  cliOutput = RAW_TYPES,
  cliStatus = 0,
  prettier = "real",
} = {}) {
  const root = path.join(base, `fixture-${fixtureCount++}`);
  const bin = path.join(root, "node_modules/.bin");
  const tmp = path.join(root, "tmp");
  fs.mkdirSync(bin, { recursive: true });
  fs.mkdirSync(path.join(root, "supabase"));
  fs.mkdirSync(path.join(root, "packages/database"), { recursive: true });
  fs.mkdirSync(tmp);
  fs.writeFileSync(
    path.join(root, "supabase/config.toml"),
    'project_id = "fixture"\n',
  );
  fs.copyFileSync(
    path.join(repoRoot, ".editorconfig"),
    path.join(root, ".editorconfig"),
  );
  fs.copyFileSync(
    path.join(repoRoot, "supabase-gen-types.sh"),
    path.join(root, "supabase-gen-types.sh"),
  );
  fs.writeFileSync(path.join(root, "cli-output.ts"), cliOutput);
  fs.writeFileSync(path.join(root, "cli-status"), String(cliStatus));
  fs.writeFileSync(path.join(bin, "supabase"), FAKE_CLI, { mode: 0o755 });
  if (prettier === "real") {
    fs.symlinkSync(repoPrettier, path.join(bin, "prettier"));
  } else if (prettier !== "missing") {
    fs.writeFileSync(path.join(bin, "prettier"), prettier, { mode: 0o755 });
  }
  return { root, tmp, artifact: path.join(root, ARTIFACT) };
}

// Prettier enables Node's compile cache under TMPDIR; disable it so the fixture
// TMPDIR only ever holds the helper's own temporary files.
function runHelper(fixture, args = [], cwd = fixture.root) {
  return spawnSync(
    "bash",
    [path.join(fixture.root, "supabase-gen-types.sh"), ...args],
    {
      cwd,
      encoding: "utf8",
      env: {
        ...process.env,
        TMPDIR: fixture.tmp,
        NODE_DISABLE_COMPILE_CACHE: "1",
      },
    },
  );
}

function formatWithRepoPrettier(
  source,
  filepath = path.join(repoRoot, ARTIFACT),
) {
  const result = spawnSync(
    process.execPath,
    [repoPrettier, "--stdin-filepath", filepath],
    { cwd: repoRoot, input: source, encoding: "utf8" },
  );
  assert.equal(result.status, 0, result.stderr);
  return result.stdout;
}

function read(file) {
  return fs.readFileSync(file, "utf8");
}

// Check mode uses mktemp under TMPDIR; write mode uses a dot file beside the
// destination for the atomic rename.
function assertNoTempFiles(fixture, destination) {
  assert.deepEqual(fs.readdirSync(fixture.tmp), []);
  const prefix = `.${path.basename(destination)}.`;
  assert.deepEqual(
    fs
      .readdirSync(path.dirname(destination))
      .filter((name) => name.startsWith(prefix)),
    [],
  );
}

test("write formats the whole CLI output like repository Prettier and --check accepts it", () => {
  const fixture = createFixture();
  const expected = formatWithRepoPrettier(RAW_TYPES);
  assert.notEqual(expected, RAW_TYPES);

  const write = runHelper(fixture);
  assert.equal(write.status, 0, write.stderr);
  assert.equal(read(fixture.artifact), expected);
  assert.equal(formatWithRepoPrettier(read(fixture.artifact)), expected);
  assert.doesNotMatch(read(fixture.artifact), /[ \t]$/m);
  assert.equal(
    read(path.join(fixture.root, "cli.log")),
    `--workdir ${fixture.root} --agent no gen types typescript --local --schema storage,public,functions\n`,
  );
  assertNoTempFiles(fixture, fixture.artifact);

  const check = runHelper(fixture, ["--check"]);
  assert.equal(check.status, 0, check.stderr);
  assert.match(check.stderr, /up to date/);
  assert.equal(read(fixture.artifact), expected);
  assertNoTempFiles(fixture, fixture.artifact);
});

test("every destination gets the canonical bytes whatever its Prettier config or the caller's cwd", () => {
  const fixture = createFixture();
  const external = path.join(base, `external-${fixtureCount++}`);
  fs.mkdirSync(path.join(fixture.root, "expo"));
  fs.mkdirSync(external);
  fs.writeFileSync(
    path.join(fixture.root, "expo/.prettierrc.json"),
    CONFLICTING_CONFIG,
  );
  fs.writeFileSync(path.join(external, ".prettierrc.json"), CONFLICTING_CONFIG);
  const canonical = formatWithRepoPrettier(RAW_TYPES);
  assert.notEqual(
    formatWithRepoPrettier(RAW_TYPES, path.join(external, "out.ts")),
    canonical,
    "the conflicting config must change bytes for this test to mean anything",
  );

  assert.equal(runHelper(fixture).status, 0);
  const expoOutput = path.join(fixture.root, "expo/example.ts");
  assert.equal(runHelper(fixture, ["--output", expoOutput]).status, 0);
  const relative = runHelper(fixture, ["--output", "out.ts"], external);
  assert.equal(relative.status, 0, relative.stderr);

  assert.equal(read(fixture.artifact), canonical);
  assert.equal(read(expoOutput), canonical);
  assert.equal(read(path.join(external, "out.ts")), canonical);
  assert.equal(fs.existsSync(path.join(fixture.root, "out.ts")), false);
  assert.equal(
    runHelper(fixture, ["--check", "--output", "out.ts"], external).status,
    0,
  );
  assertNoTempFiles(fixture, path.join(external, "out.ts"));
});

test("--check reports drift or a missing artifact with exit 1 and writes nothing", () => {
  const fixture = createFixture();
  assert.equal(runHelper(fixture).status, 0);
  const drifted = `${read(fixture.artifact)}// sentinel\n`;
  fs.writeFileSync(fixture.artifact, drifted);

  const check = runHelper(fixture, ["--check"]);
  assert.equal(check.status, 1);
  assert.match(check.stderr, /out of date/);
  assert.equal(read(fixture.artifact), drifted);

  const missing = path.join(fixture.root, "packages/database/missing.ts");
  assert.equal(runHelper(fixture, ["--check", "--output", missing]).status, 1);
  assert.equal(fs.existsSync(missing), false);
  assertNoTempFiles(fixture, fixture.artifact);
});

test("a CLI failure after valid output exits 2 and preserves the artifact in write and check modes", () => {
  const fixture = createFixture({ cliStatus: 1 });
  assert.match(formatWithRepoPrettier(RAW_TYPES), /^export type Database = /m);
  fs.writeFileSync(fixture.artifact, PRIOR_ARTIFACT);

  for (const args of [[], ["--check"]]) {
    const result = runHelper(fixture, args);
    assert.equal(result.status, 2, `${args}: ${result.stderr}`);
    assert.match(
      result.stderr,
      /Type generation failed \(supabase exit 1, prettier exit 0\)/,
    );
    assert.equal(read(fixture.artifact), PRIOR_ARTIFACT);
    assertNoTempFiles(fixture, fixture.artifact);
  }
});

test("a Prettier failure exits 2 and preserves the artifact in write and check modes", () => {
  const fixture = createFixture({ prettier: FAILING_PRETTIER });
  fs.writeFileSync(fixture.artifact, PRIOR_ARTIFACT);

  for (const args of [[], ["--check"]]) {
    const result = runHelper(fixture, args);
    assert.equal(result.status, 2, `${args}: ${result.stderr}`);
    assert.match(
      result.stderr,
      /Formatting generated types with Prettier failed \(exit 2\)/,
    );
    assert.equal(read(fixture.artifact), PRIOR_ARTIFACT);
    assertNoTempFiles(fixture, fixture.artifact);
  }
});

test("a missing repository Prettier fails before the CLI runs", () => {
  const fixture = createFixture({ prettier: "missing" });
  fs.writeFileSync(fixture.artifact, PRIOR_ARTIFACT);

  const result = runHelper(fixture);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /Repository Prettier not found/);
  assert.equal(fs.existsSync(path.join(fixture.root, "cli.log")), false);
  assert.equal(read(fixture.artifact), PRIOR_ARTIFACT);
  assertNoTempFiles(fixture, fixture.artifact);
});

test("formatted output that is empty or lacks the Database export is rejected", () => {
  for (const cliOutput of ["", "export const unrelated = 1\n"]) {
    const fixture = createFixture({ cliOutput });
    fs.writeFileSync(fixture.artifact, PRIOR_ARTIFACT);

    const result = runHelper(fixture);
    assert.equal(result.status, 2, result.stderr);
    assert.match(result.stderr, /empty or has no exported Database type/);
    assert.equal(read(fixture.artifact), PRIOR_ARTIFACT);
    assertNoTempFiles(fixture, fixture.artifact);
  }
});
