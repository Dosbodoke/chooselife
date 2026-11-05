#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import path from "node:path";
import { childEnv } from "./verify-database.mjs";

const [name, ...extra] = process.argv.slice(2);
if (!name || extra.length || !/^[a-z][a-z0-9_]{0,79}$/.test(name)) {
  console.error("Usage: pnpm db:schema:diff <lowercase_name> (no extra flags)");
  process.exitCode = 2;
} else {
  const root = path.resolve(import.meta.dirname, "..");
  const result = spawnSync(
    process.execPath,
    [
      path.join(root, "node_modules/supabase/dist/supabase.js"),
      "--workdir",
      root,
      "--agent",
      "no",
      "--output-format",
      "text",
      "db",
      "schema",
      "declarative",
      "sync",
      "--no-apply",
      "--strict-coverage",
      "-f",
      name,
    ],
    {
      cwd: root,
      env: { ...childEnv(), SUPABASE_YES: "false" },
      stdio: "inherit",
    },
  );
  if (result.error) console.error(result.error.message);
  process.exitCode = result.status ?? 1;
}
