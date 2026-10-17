#!/usr/bin/env node
// Compare two captures of supabase/verification/catalog.sql.
//
// Usage: pnpm db:catalog:compare <left.json> <right.json>
//
// Each file holds the catalog payload itself or the output of a tool that ran
// the query: `supabase db query --output json` rows, the CLI's agent envelope
// or stream-json result line, or the Supabase SQL connector's text result.
// Differences are reported by object identity and field path, plus grant
// entries and platform versions. Definitions, defaults and other values are
// never printed.
// Exit codes: 0 same application semantics, 1 semantic differences, 2 usage
// error or unreadable input.

import fs from "node:fs/promises";
import { isDeepStrictEqual } from "node:util";

export const FORMAT = "chooselife.catalog.v1";

export const SECTIONS = [
  "extensions",
  "schemas",
  "relations",
  "constraints",
  "indexes",
  "types",
  "functions",
  "policies",
  "triggers",
  "rules",
  "event_triggers",
  "default_acls",
  "managed_grants",
  "publications",
  "publication_tables",
  "cron_jobs",
  "storage_buckets",
];

// Arrays whose order carries no meaning. Every list under `effective` is one
// too. Columns, composite attributes, enum labels and partition or publication
// column lists keep their order.
const SET_FIELDS = new Set([
  "acl",
  "roles",
  "events",
  "options",
  "config",
  "schemas",
  "tags",
  "inherits",
  "allowed_mime_types",
]);
// Set entries that are grant or role identities, safe to name in a report.
const NAMED_SET_FIELDS = new Set(["acl", "roles", "events"]);
// Ordered lists of objects keyed by `name`.
const NAMED_LIST_FIELDS = new Set(["columns", "attributes"]);

// The connector's preamble names the tag in a sentence, so only tags on their
// own line delimit the data.
const UNTRUSTED_BLOCK =
  /^[ \t]*<untrusted-data-([0-9a-f-]+)>[ \t\r]*$([\s\S]*?)^[ \t]*<\/untrusted-data-\1>[ \t\r]*$/gm;
const MAX_UNWRAP_DEPTH = 6;

const USAGE = `Usage: pnpm db:catalog:compare <left.json> <right.json>

Compares two outputs of supabase/verification/catalog.sql. Exits 0 when the
application semantics match, 1 when they differ and 2 when an input cannot be
read as a complete catalog.`;

export class CatalogInputError extends Error {}

const isPlainObject = (value) =>
  typeof value === "object" && value !== null && !Array.isArray(value);

function parseJson(text, what) {
  try {
    return JSON.parse(text);
  } catch {
    throw new CatalogInputError(`${what} is not valid JSON.`);
  }
}

// Accepts the catalog document or any supported result wrapper around it.
export function extractCatalog(text) {
  if (typeof text !== "string" || text.trim() === "") {
    throw new CatalogInputError("Input is empty.");
  }
  return validateCatalog(unwrap(parseText(text), 0));
}

function parseText(text) {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    // Not a single JSON document; try the other known shapes.
  }

  const blocks = [...trimmed.matchAll(UNTRUSTED_BLOCK)];
  if (blocks.length > 1) {
    throw new CatalogInputError(
      "Input has more than one untrusted-data block.",
    );
  }
  if (blocks.length === 1) {
    return parseJson(blocks[0][2].trim(), "The untrusted-data block");
  }

  // CLI stream-json: one JSON event per line, exactly one of them the result.
  const lines = trimmed.split("\n").filter((line) => line.trim() !== "");
  if (lines.length > 1) {
    const events = lines.map((line) => parseJson(line, "A stream-json line"));
    const results = events.filter(
      (event) => isPlainObject(event) && event.type === "result",
    );
    if (results.length !== 1) {
      throw new CatalogInputError(
        `Expected one stream-json result event, found ${results.length}.`,
      );
    }
    return results[0];
  }
  throw new CatalogInputError("Input is not valid JSON.");
}

function unwrap(value, depth) {
  if (depth > MAX_UNWRAP_DEPTH) {
    throw new CatalogInputError("Input is nested too deeply.");
  }
  if (Array.isArray(value)) return unwrapRows(value, depth);
  if (!isPlainObject(value)) {
    throw new CatalogInputError("Input is not a catalog or query result.");
  }
  if ("format" in value) return value;
  // CLI agent envelope: {boundary, rows, warning}, optionally with advisory.
  if (Array.isArray(value.rows) && typeof value.boundary === "string") {
    return unwrapRows(value.rows, depth);
  }
  // CLI stream-json result event.
  if (value.type === "result" && "data" in value) {
    return unwrap(value.data, depth + 1);
  }
  // SQL connector structured result: {result: "<text with untrusted-data>"}.
  if (typeof value.result === "string" && Object.keys(value).length === 1) {
    return unwrap(parseText(value.result), depth + 1);
  }
  throw new CatalogInputError("Input is not a catalog or query result.");
}

function unwrapRows(rows, depth) {
  if (rows.length !== 1) {
    throw new CatalogInputError(
      `Expected exactly one result row, found ${rows.length}.`,
    );
  }
  const [row] = rows;
  if (!isPlainObject(row) || Object.keys(row).join() !== "catalog") {
    throw new CatalogInputError(
      "Expected the result row to have exactly one column named catalog.",
    );
  }
  // Clients return jsonb either parsed or as text.
  const cell =
    typeof row.catalog === "string"
      ? parseJson(row.catalog, "The catalog column")
      : row.catalog;
  return unwrap(cell, depth + 1);
}

export function validateCatalog(catalog) {
  if (!isPlainObject(catalog) || catalog.format !== FORMAT) {
    throw new CatalogInputError(`Input is not a ${FORMAT} catalog.`);
  }
  const expectedKeys = ["format", "environment", "counts", ...SECTIONS];
  const unexpected = Object.keys(catalog).filter(
    (key) => !expectedKeys.includes(key),
  );
  if (unexpected.length > 0) {
    throw new CatalogInputError(
      `Catalog has unexpected sections: ${unexpected.sort().join(", ")}.`,
    );
  }

  const environment = catalog.environment;
  if (
    !isPlainObject(environment) ||
    typeof environment.server_version_num !== "string" ||
    typeof environment.app_owner !== "string" ||
    typeof environment.complete_visibility !== "boolean" ||
    !isPlainObject(environment.extension_versions) ||
    !Object.values(environment.extension_versions).every(
      (version) => typeof version === "string",
    )
  ) {
    throw new CatalogInputError("Catalog environment is missing or malformed.");
  }
  // Without BYPASSRLS, RLS on cron.job and storage.buckets hides rows silently.
  if (environment.complete_visibility !== true) {
    throw new CatalogInputError(
      "Catalog was captured by a role that does not bypass RLS, so cron jobs and buckets may be missing.",
    );
  }

  if (!isPlainObject(catalog.counts)) {
    throw new CatalogInputError("Catalog counts are missing.");
  }
  for (const section of SECTIONS) {
    const items = catalog[section];
    if (!Array.isArray(items)) {
      throw new CatalogInputError(`Catalog section ${section} is missing.`);
    }
    if (catalog.counts[section] !== items.length) {
      throw new CatalogInputError(
        `Catalog section ${section} has ${items.length} entries but its count says ${catalog.counts[section]}.`,
      );
    }
    const ids = new Set();
    for (const item of items) {
      if (!isPlainObject(item) || typeof item.id !== "string" || !item.id) {
        throw new CatalogInputError(
          `Catalog section ${section} has an entry without an id.`,
        );
      }
      if (ids.has(item.id)) {
        throw new CatalogInputError(
          `Catalog section ${section} has duplicate id ${item.id}.`,
        );
      }
      ids.add(item.id);
    }
  }
  return catalog;
}

const sortedSet = (values) =>
  values.map((value) => JSON.stringify(value)).sort();

function compareSet(path, field, left, right, out) {
  const leftSet = sortedSet(left);
  const rightSet = sortedSet(right);
  if (isDeepStrictEqual(leftSet, rightSet)) return;
  if (!NAMED_SET_FIELDS.has(field) && !path.includes(".effective.")) {
    out.push(`${path}: differs`);
    return;
  }
  const onlyLeft = leftSet.filter((entry) => !rightSet.includes(entry));
  const onlyRight = rightSet.filter((entry) => !leftSet.includes(entry));
  const describe = (entries) =>
    entries.map((entry) => JSON.parse(entry)).join(", ") || "none";
  out.push(
    `${path}: only in left: ${describe(onlyLeft)}; only in right: ${describe(onlyRight)}`,
  );
}

function compareNamedList(path, left, right, out) {
  const names = (list) =>
    list.map((item) => (isPlainObject(item) ? item.name : undefined));
  const leftNames = names(left);
  const rightNames = names(right);
  if (
    [...leftNames, ...rightNames].some((name) => typeof name !== "string") ||
    new Set(leftNames).size !== leftNames.length ||
    new Set(rightNames).size !== rightNames.length
  ) {
    if (!isDeepStrictEqual(left, right)) out.push(`${path}: differs`);
    return;
  }
  if (!isDeepStrictEqual(leftNames, rightNames)) {
    const onlyLeft = leftNames.filter((name) => !rightNames.includes(name));
    const onlyRight = rightNames.filter((name) => !leftNames.includes(name));
    out.push(
      onlyLeft.length || onlyRight.length
        ? `${path}: only in left: ${onlyLeft.join(", ") || "none"}; only in right: ${onlyRight.join(", ") || "none"}`
        : `${path}: order differs`,
    );
  }
  for (const item of left) {
    const match = right.find((other) => other.name === item.name);
    if (match) compareValue(`${path}.${item.name}`, item, match, out);
  }
}

function compareValue(path, left, right, out) {
  const field = path.slice(path.lastIndexOf(".") + 1);
  if (Array.isArray(left) && Array.isArray(right)) {
    if (SET_FIELDS.has(field) || path.includes(".effective.")) {
      compareSet(path, field, left, right, out);
    } else if (NAMED_LIST_FIELDS.has(field)) {
      compareNamedList(path, left, right, out);
    } else if (!isDeepStrictEqual(left, right)) {
      out.push(`${path}: differs`);
    }
    return;
  }
  if (isPlainObject(left) && isPlainObject(right)) {
    const keys = [...new Set([...Object.keys(left), ...Object.keys(right)])];
    for (const key of keys.sort()) {
      if (!(key in right)) out.push(`${path}.${key}: only in left`);
      else if (!(key in left)) out.push(`${path}.${key}: only in right`);
      else compareValue(`${path}.${key}`, left[key], right[key], out);
    }
    return;
  }
  if (!isDeepStrictEqual(left, right)) out.push(`${path}: differs`);
}

// Returns semantic differences and, separately, environment metadata that may
// differ between platform patch versions without changing the application.
export function compareCatalogs(left, right) {
  const differences = [];
  const environment = [];

  if (left.environment.app_owner !== right.environment.app_owner) {
    differences.push("environment.app_owner: differs");
  }
  if (
    left.environment.server_version_num !== right.environment.server_version_num
  ) {
    environment.push(
      `server_version_num: ${left.environment.server_version_num} vs ${right.environment.server_version_num}`,
    );
  }
  const leftVersions = left.environment.extension_versions;
  const rightVersions = right.environment.extension_versions;
  for (const name of Object.keys(leftVersions).sort()) {
    if (name in rightVersions && leftVersions[name] !== rightVersions[name]) {
      environment.push(
        `extension ${name} version: ${leftVersions[name]} vs ${rightVersions[name]}`,
      );
    }
  }

  for (const section of SECTIONS) {
    const leftItems = new Map(left[section].map((item) => [item.id, item]));
    const rightItems = new Map(right[section].map((item) => [item.id, item]));
    const ids = [...new Set([...leftItems.keys(), ...rightItems.keys()])];
    for (const id of ids.sort()) {
      const label = `${section} ${id}`;
      if (!rightItems.has(id)) differences.push(`${label}: only in left`);
      else if (!leftItems.has(id)) differences.push(`${label}: only in right`);
      else {
        const { id: _left, ...leftFields } = leftItems.get(id);
        const { id: _right, ...rightFields } = rightItems.get(id);
        const fieldDifferences = [];
        compareValue("", leftFields, rightFields, fieldDifferences);
        for (const difference of fieldDifferences) {
          differences.push(`${label}: ${difference.slice(1)}`);
        }
      }
    }
  }
  return { differences, environment };
}

export async function readCatalog(file) {
  let text;
  try {
    text = await fs.readFile(file, "utf8");
  } catch (error) {
    throw new CatalogInputError(`Cannot read ${file}: ${error.code ?? error}.`);
  }
  try {
    return extractCatalog(text);
  } catch (error) {
    if (error instanceof CatalogInputError) {
      throw new CatalogInputError(`${file}: ${error.message}`);
    }
    throw error;
  }
}

export async function main(
  argv,
  { log = console.log, error = console.error } = {},
) {
  if (argv.length === 1 && ["-h", "--help"].includes(argv[0])) {
    log(USAGE);
    return 0;
  }
  if (argv.length !== 2) {
    error(USAGE);
    return 2;
  }
  let left;
  let right;
  try {
    left = await readCatalog(argv[0]);
    right = await readCatalog(argv[1]);
  } catch (caught) {
    if (!(caught instanceof CatalogInputError)) throw caught;
    error(`[db:catalog] ${caught.message}`);
    return 2;
  }

  const { differences, environment } = compareCatalogs(left, right);
  if (environment.length > 0) {
    log(
      "[db:catalog] Environment metadata differs (not application semantics):",
    );
    for (const line of environment) log(`  ${line}`);
  }
  if (differences.length === 0) {
    log("[db:catalog] Application catalogs match.");
    return 0;
  }
  log(`[db:catalog] Application catalogs differ (${differences.length}):`);
  for (const line of differences) log(`  ${line}`);
  return 1;
}

if (import.meta.main) {
  process.exitCode = await main(process.argv.slice(2));
}
