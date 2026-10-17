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

export const FORMAT = "chooselife.catalog.v2";

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
  "managed_security",
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
const UNTRUSTED_TAG = /^[ \t]*<(\/?)untrusted-data-([0-9a-f-]+)>[ \t\r]*$/gm;
// Any tag, complete or not, anywhere in the text or at the start of a line.
const ANY_TAG = /<\/?untrusted-data-/g;
const COMPLETE_TAG = /^<\/?untrusted-data-[0-9a-f-]+>/;
const LINE_STARTING_WITH_TAG = /^[ \t]*<\/?untrusted-data-/gm;
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

  // Connector text: exactly one opening tag line and its closing tag line.
  // Tags elsewhere may only be complete tags named inside a sentence. Any
  // other tag, such as a second, partial or truncated block, is rejected.
  const anyTags = [...trimmed.matchAll(ANY_TAG)];
  if (anyTags.length > 0) {
    const tags = [...trimmed.matchAll(UNTRUSTED_TAG)];
    const [open, close] = tags;
    if (
      anyTags.some((tag) => !COMPLETE_TAG.test(trimmed.slice(tag.index))) ||
      [...trimmed.matchAll(LINE_STARTING_WITH_TAG)].length !== tags.length ||
      tags.length !== 2 ||
      open[1] !== "" ||
      close[1] !== "/" ||
      open[2] !== close[2]
    ) {
      throw new CatalogInputError(
        "Input needs exactly one matching pair of untrusted-data tag lines.",
      );
    }
    return parseJson(
      trimmed.slice(open.index + open[0].length, close.index).trim(),
      "The untrusted-data block",
    );
  }

  // CLI stream-json: one JSON event per line, exactly one of them the result.
  // Log and progress events may surround it; an error event or error-level
  // log means the command failed, even if a result was printed.
  const lines = trimmed.split("\n").filter((line) => line.trim() !== "");
  if (lines.length > 1) {
    const events = lines.map((line) => parseJson(line, "A stream-json line"));
    if (
      events.some(
        (event) =>
          isPlainObject(event) &&
          (event.type === "error" ||
            (event.type === "log" && event.level === "error")),
      )
    ) {
      throw new CatalogInputError("The stream-json output reports an error.");
    }
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

// Value checks for the record shapes below. A failure is reported by section,
// identity and field, never by value.
const isString = (value) => typeof value === "string";
const isBoolean = (value) => typeof value === "boolean";
// A Postgres "char" code such as relkind or prokind.
const isFlag = (value) => isString(value) && value.length === 1;
const isDigest = (value) => isString(value) && /^[0-9a-f]{64}$/.test(value);
const isAclEntry = (value) => isString(value) && /^.+:[A-Z]+\*?$/.test(value);
const isPrivilege = (value) => isString(value) && /^[A-Z]+$/.test(value);
const nullable = (check) => (value) => value === null || check(value);
const listOf = (check) => (value) => Array.isArray(value) && value.every(check);
const setOf = (check) => (value) =>
  listOf(check)(value) && new Set(value).size === value.length;
const hasExactKeys = (value, keys) =>
  isPlainObject(value) &&
  Object.keys(value).length === keys.length &&
  keys.every((key) => Object.hasOwn(value, key));
const isRecord = (shape) => (value) =>
  hasExactKeys(value, Object.keys(shape)) &&
  Object.entries(shape).every(([key, check]) => check(value[key]));
// Ordered records with unique names, such as columns.
const namedListOf = (shape) => (value) =>
  listOf(isRecord(shape))(value) &&
  new Set(value.map((item) => item.name)).size === value.length;

const API_ROLES = ["anon", "authenticated", "service_role"];
const isEffective = (value) =>
  hasExactKeys(value, API_ROLES) &&
  API_ROLES.every((role) => setOf(isPrivilege)(value[role]));
const acl = setOf(isAclEntry);
const comment = nullable(isString);

const SECURITY_STATE = {
  owner: isString,
  acl,
  effective: isEffective,
  rls_enabled: nullable(isBoolean),
  rls_forced: nullable(isBoolean),
  security_definer: nullable(isBoolean),
  config: nullable(listOf(isString)),
  columns: nullable(
    namedListOf({ name: isString, acl, effective: isEffective }),
  ),
};
// The security fields each managed kind must have; the others must be null.
const MANAGED_KIND_FIELDS = {
  relation: ["rls_enabled", "rls_forced", "columns"],
  function: ["security_definer", "config"],
  type: [],
};
const KIND_SPECIFIC_FIELDS = Object.values(MANAGED_KIND_FIELDS).flat();
const EXTENSION_STATE_KINDS = [
  ["routine_security", "function"],
  ["type_security", "type"],
];

// Every field each section's entries carry besides `id`, as catalog.sql
// emits them.
const SHAPES = {
  extensions: {
    schema: isString,
    routine_security: nullable(isRecord(SECURITY_STATE)),
    type_security: nullable(isRecord(SECURITY_STATE)),
  },
  schemas: {
    owner: isString,
    extension_member: isBoolean,
    comment,
    acl,
    effective: isEffective,
  },
  relations: {
    kind: isFlag,
    owner: isString,
    persistence: isFlag,
    options: listOf(isString),
    rls_enabled: isBoolean,
    rls_forced: isBoolean,
    replica_identity: isFlag,
    replica_identity_index: nullable(isString),
    partition_of: nullable(isString),
    partition_bound: nullable(isString),
    partition_key: nullable(isString),
    inherits: listOf(isString),
    view_digest: nullable(isDigest),
    comment,
    acl,
    effective: isEffective,
    sequence: nullable(
      isRecord({
        type: isString,
        start: isString,
        increment: isString,
        min: isString,
        max: isString,
        cache: isString,
        cycle: isBoolean,
        owned_by: nullable(isString),
      }),
    ),
    columns: namedListOf({
      name: isString,
      type: isString,
      not_null: isBoolean,
      default: nullable(isString),
      identity: nullable(isFlag),
      generated: nullable(isFlag),
      collation: nullable(isString),
      comment,
      acl,
      effective: nullable(isEffective),
    }),
  },
  constraints: {
    on: (value) => value === "table" || value === "domain",
    type: isFlag,
    definition: isString,
    deferrable: isBoolean,
    deferred: isBoolean,
    validated: isBoolean,
    comment,
  },
  indexes: {
    table: isString,
    definition: isString,
    unique: isBoolean,
    primary: isBoolean,
    valid: isBoolean,
    constraint: isBoolean,
    comment,
  },
  types: {
    kind: isFlag,
    owner: isString,
    labels: nullable(setOf(isString)),
    base_type: nullable(isString),
    not_null: isBoolean,
    default: nullable(isString),
    attributes: nullable(namedListOf({ name: isString, type: isString })),
    comment,
    acl,
  },
  functions: {
    kind: isFlag,
    owner: isString,
    language: isString,
    returns: nullable(isString),
    arguments_digest: isDigest,
    body_digest: isDigest,
    security_definer: isBoolean,
    volatility: isFlag,
    strict: isBoolean,
    leakproof: isBoolean,
    parallel: isFlag,
    cost: isString,
    rows: isString,
    config: listOf(isString),
    comment,
    acl,
    effective: isEffective,
  },
  policies: {
    table: isString,
    command: isFlag,
    permissive: isBoolean,
    roles: setOf(isString),
    using_digest: nullable(isDigest),
    check_digest: nullable(isDigest),
    comment,
  },
  triggers: {
    table: isString,
    function: isString,
    enabled: isFlag,
    timing: isString,
    level: isString,
    events: setOf(isString),
    constraint: isBoolean,
    deferrable: isBoolean,
    deferred: isBoolean,
    definition_digest: isDigest,
    comment,
  },
  rules: { enabled: isFlag, definition_digest: isDigest },
  event_triggers: {
    owner: isString,
    event: isString,
    function: isString,
    enabled: isFlag,
    tags: listOf(isString),
  },
  default_acls: { acl },
  managed_security: {
    kind: isFlag,
    extension: nullable(isString),
    ...SECURITY_STATE,
  },
  publications: {
    owner: isString,
    all_tables: isBoolean,
    insert: isBoolean,
    update: isBoolean,
    delete: isBoolean,
    truncate: isBoolean,
    via_root: isBoolean,
    schemas: setOf(isString),
  },
  publication_tables: {
    columns: nullable(listOf(isString)),
    row_filter_digest: nullable(isDigest),
  },
  cron_jobs: {
    schedule: isString,
    active: isBoolean,
    database: isString,
    username: isString,
    command_digest: isDigest,
  },
  storage_buckets: {
    id_is_name: isBoolean,
    public: nullable(isBoolean),
    file_size_limit: nullable(Number.isFinite),
    allowed_mime_types: nullable(listOf(isString)),
  },
};

const isEnvironment = isRecord({
  server_version_num: isString,
  app_owner: isString,
  complete_visibility: isBoolean,
  extension_versions: (value) =>
    isPlainObject(value) && Object.values(value).every(isString),
});

function validateEntry(section, item, index) {
  if (!isPlainObject(item) || !isString(item.id) || item.id === "") {
    throw new CatalogInputError(
      `Catalog section ${section} entry ${index} has no id.`,
    );
  }
  const shape = SHAPES[section];
  const fail = (problem) => {
    throw new CatalogInputError(
      `Catalog section ${section} entry ${item.id} ${problem}.`,
    );
  };
  for (const key of Object.keys(item)) {
    if (key !== "id" && !Object.hasOwn(shape, key)) {
      fail(`has unexpected field ${key}`);
    }
  }
  for (const [key, check] of Object.entries(shape)) {
    if (!Object.hasOwn(item, key)) fail(`is missing field ${key}`);
    if (!check(item[key])) fail(`has a malformed ${key}`);
  }
  if (section === "managed_security") {
    const kind = item.id.split(" ")[0];
    if (!Object.hasOwn(MANAGED_KIND_FIELDS, kind)) {
      fail("has an unknown object kind");
    }
    checkKindFields(item, kind, "", fail);
  }
  // An extension's common states are those of its functions and its types.
  if (section === "extensions") {
    for (const [field, kind] of EXTENSION_STATE_KINDS) {
      if (item[field] !== null) {
        checkKindFields(item[field], kind, `${field}.`, fail);
      }
    }
  }
}

// The security fields a kind has must be set; the others must be null.
function checkKindFields(state, kind, prefix, fail) {
  const required = MANAGED_KIND_FIELDS[kind];
  for (const key of KIND_SPECIFIC_FIELDS) {
    if ((state[key] !== null) !== required.includes(key)) {
      fail(`has a malformed ${prefix}${key} for its kind`);
    }
  }
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

  if (!isEnvironment(catalog.environment)) {
    throw new CatalogInputError("Catalog environment is missing or malformed.");
  }
  // Without BYPASSRLS, RLS on cron.job and storage.buckets hides rows silently.
  if (catalog.environment.complete_visibility !== true) {
    throw new CatalogInputError(
      "Catalog was captured by a role that does not bypass RLS, so cron jobs and buckets may be missing.",
    );
  }

  if (!hasExactKeys(catalog.counts, SECTIONS)) {
    throw new CatalogInputError("Catalog counts are missing or malformed.");
  }
  for (const section of SECTIONS) {
    const items = catalog[section];
    if (!Array.isArray(items)) {
      throw new CatalogInputError(`Catalog section ${section} is missing.`);
    }
    if (catalog.counts[section] !== items.length) {
      throw new CatalogInputError(
        `Catalog section ${section} has ${items.length} entries but its count disagrees.`,
      );
    }
    const ids = new Set();
    items.forEach((item, index) => {
      validateEntry(section, item, index);
      if (ids.has(item.id)) {
        throw new CatalogInputError(
          `Catalog section ${section} has duplicate id ${item.id}.`,
        );
      }
      ids.add(item.id);
    });
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
