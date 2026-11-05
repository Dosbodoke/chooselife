// Independent verifier for the declarations, using PostgreSQL itself rather
// than pg-delta's SQL emitter. Never used to produce deployable migrations.
import fs from "node:fs/promises";
import path from "node:path";

// Split only outside SQL strings, quoted identifiers, dollar-quoted bodies,
// comments, and parentheses. Also used to split CREATE TABLE elements.
export function splitSql(source, delimiter = ";") {
  const parts = [];
  let start = 0,
    quote = null,
    dollar = null,
    block = 0,
    line = false,
    depth = 0;
  for (let i = 0; i < source.length; i++) {
    const c = source[i],
      next = source[i + 1];
    if (line) {
      if (c === "\n") line = false;
      continue;
    }
    if (block) {
      if (c === "/" && next === "*") {
        block++;
        i++;
      } else if (c === "*" && next === "/") {
        block--;
        i++;
      }
      continue;
    }
    if (dollar) {
      if (source.startsWith(dollar, i)) {
        i += dollar.length - 1;
        dollar = null;
      }
      continue;
    }
    if (quote) {
      if (c === "\\" && quote === "E") {
        i++;
        continue;
      }
      if (c === (quote === "E" ? "'" : quote)) {
        if (next === c) i++;
        else quote = null;
      }
      continue;
    }
    if (c === "-" && next === "-") {
      line = true;
      i++;
      continue;
    }
    if (c === "/" && next === "*") {
      block = 1;
      i++;
      continue;
    }
    if (c === "'" || c === '"') {
      quote =
        c === "'" &&
        /[eE]/.test(source[i - 1] ?? "") &&
        !/[\w$]/.test(source[i - 2] ?? "")
          ? "E"
          : c;
      continue;
    }
    if (c === "$") {
      const match = /^\$(?:[a-zA-Z_][\w]*)?\$/.exec(source.slice(i));
      if (match) {
        dollar = match[0];
        i += dollar.length - 1;
        continue;
      }
    }
    if (c === "(") depth++;
    if (c === ")") depth--;
    if (depth < 0) throw new Error("Unbalanced SQL parentheses");
    if (c === delimiter && depth === 0) {
      parts.push(source.slice(start, i).trim());
      start = i + 1;
    }
  }
  if (quote || dollar || block || depth)
    throw new Error("Unterminated SQL construct");
  if (source.slice(start).trim()) parts.push(source.slice(start).trim());
  return parts.filter(Boolean);
}

function stripLeadingComments(sql) {
  // Generated declarations use line comments outside bodies.
  return sql.replace(/^(?:\s*--[^\n]*(?:\n|$))*/, "").trim();
}

export function reconstructionStatements(sources) {
  const statements = [];
  for (const { name, sql } of sources) {
    for (let statement of splitSql(sql)) {
      statement = stripLeadingComments(statement);
      if (!statement) continue;
      if (/^(?:INSERT|UPDATE|DELETE|COPY|TRUNCATE|DO)\b/i.test(statement))
        throw new Error(
          `Ordinary DML or procedural provisioning is not a declaration: ${name}`,
        );
      if (
        /^SELECT\b/i.test(statement) &&
        !/^SELECT\s+cron\.schedule_in_database\(/i.test(statement)
      )
        throw new Error(`Unsupported top-level SELECT in ${name}`);
      // Extensions already supplied by the fresh platform are left in place;
      // the independent catalog still checks their schema/owner/permissions.
      statement = statement.replace(
        /^CREATE EXTENSION (?!IF NOT EXISTS)/i,
        "CREATE EXTENSION IF NOT EXISTS ",
      );
      const table =
        /^CREATE TABLE ((?:"[^"]+"\.)?"[^"]+")\s*\(([\s\S]*)\)$/i.exec(
          statement,
        );
      if (table) {
        const columns = [],
          constraints = [];
        for (const element of splitSql(table[2], ",")) {
          if (/^CONSTRAINT\b/i.test(element)) constraints.push(element);
          else columns.push(element);
        }
        // Defer constraints to break FK cycles and function dependencies, while
        // preserving the exact declared column order and CHECK expressions.
        statements.push(`CREATE TABLE ${table[1]} (${columns.join(",\n")})`);
        statements.push(
          ...constraints.map(
            (constraint) => `ALTER TABLE ${table[1]} ADD ${constraint}`,
          ),
        );
      } else {
        if (/^CREATE TABLE\b/i.test(statement))
          throw new Error(`Unsupported table syntax in ${name}`);
        statements.push(statement);
      }
    }
  }
  return statements;
}

export async function reconstructionSql(schemaRoot) {
  const files = [];
  async function visit(directory) {
    for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) await visit(file);
      else if (entry.isFile() && entry.name.endsWith(".sql")) files.push(file);
      else if (!entry.isFile())
        throw new Error(`Unsupported schema input ${file}`);
    }
  }
  await visit(schemaRoot);
  if (!files.length) throw new Error("No declarative SQL files found");
  // Destination defaults must be wiped before object creation; the desired
  // defaults are restored only after all object-level grants have been applied.
  const rank = (file) =>
    file.endsWith("/schema.sql")
      ? 0
      : file.endsWith("/adp_wipes.sql")
        ? 1
        : file.endsWith("/default_privileges.sql")
          ? 3
          : 2;
  files.sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
  const sources = await Promise.all(
    files.map(async (file) => ({
      name: path.relative(schemaRoot, file),
      sql: await fs.readFile(file, "utf8"),
    })),
  );
  const defaults = reconstructionStatements(
    sources.filter((s) => s.name.endsWith("/default_privileges.sql")),
  );
  const initial = reconstructionStatements(
    sources.filter((s) => !s.name.endsWith("/default_privileges.sql")),
  );
  const literal = (s) => `'${s.replaceAll("'", "''")}'`;
  // Retry only missing-object/dependency failures. Every other error aborts.
  // Each failed attempt rolls back in its own PL/pgSQL exception subtransaction.
  return `DO $reconstruct$
DECLARE pending text[] := ARRAY[${initial.map(literal).join(",\n")}];
  deferred text[]; statement text; progressed boolean; passes integer := 0;
BEGIN
  PERFORM set_config('check_function_bodies', 'off', true);
  LOOP
    deferred := ARRAY[]::text[]; progressed := false; passes := passes + 1;
    FOREACH statement IN ARRAY pending LOOP
      BEGIN
        EXECUTE statement; progressed := true;
      EXCEPTION WHEN undefined_table OR undefined_object OR undefined_function OR invalid_foreign_key THEN
        deferred := array_append(deferred, statement);
      END;
    END LOOP;
    EXIT WHEN cardinality(deferred) = 0;
    IF NOT progressed OR passes > 100 THEN
      RAISE EXCEPTION 'Unresolved declaration dependencies: % statements; first: %', cardinality(deferred), left(deferred[1], 160);
    END IF;
    pending := deferred;
  END LOOP;
  ${defaults.map((s) => `EXECUTE ${literal(s)};`).join("\n")}
END $reconstruct$;\n`;
}
