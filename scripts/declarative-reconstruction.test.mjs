import assert from "node:assert/strict";
import { test } from "node:test";
import {
  splitSql,
  reconstructionStatements,
} from "./declarative-reconstruction.mjs";

test("splits statements outside function bodies, strings, identifiers and nested comments", () => {
  const sql = `-- a semicolon ;
CREATE FUNCTION public.f() RETURNS text LANGUAGE sql AS $body$ select 'a;b'; $body$;
/* outer ; /* inner ; */ comment */ SELECT 'it''s; valid', E'escaped\\\';quote', "a;b";`;
  const statements = splitSql(sql);
  assert.equal(statements.length, 2);
  assert.match(statements[0], /select 'a;b';/);
  assert.match(statements[1], /"a;b"/);
});

test("rejects unclosed SQL rather than applying a partial declaration", () => {
  for (const sql of [
    "SELECT 'oops",
    'SELECT "oops',
    "SELECT $body$oops",
    "SELECT (1",
    "SELECT /* oops",
  ])
    assert.throws(() => splitSql(sql), /Unterminated/);
});

test("defers table constraints while preserving column and enum positions", () => {
  const statements = reconstructionStatements([
    {
      name: "table.sql",
      sql: `
CREATE TABLE "public"."example" (
  "id" bigint GENERATED ALWAYS AS IDENTITY,
  "kind" public.kind_enum NOT NULL,
  "note" text DEFAULT 'a,b',
  CONSTRAINT "example_pkey" PRIMARY KEY (id),
  CONSTRAINT "example_fk" FOREIGN KEY (id) REFERENCES public.other(id),
  CONSTRAINT "example_check" CHECK (char_length(note) BETWEEN 1 AND 500 AND note = btrim(note))
);`,
    },
  ]);
  assert.equal(statements.length, 4);
  assert.match(statements[0], /"id"[\s\S]*"kind"[\s\S]*"note"/);
  assert.doesNotMatch(statements[0], /CONSTRAINT/);
  assert.match(statements[2], /^ALTER TABLE .* ADD CONSTRAINT "example_fk"/);
  assert.match(statements[3], /BETWEEN 1 AND 500/);
});

test("allows named cron configuration but refuses ordinary data/procedural statements", () => {
  assert.equal(
    reconstructionStatements([
      {
        name: "cron.sql",
        sql: "SELECT cron.schedule_in_database('job', '* * * * *', 'select 1', 'postgres', NULL, true);",
      },
    ]).length,
    1,
  );
  for (const sql of [
    "INSERT INTO x VALUES (1);",
    "UPDATE x SET a=1;",
    "DELETE FROM x;",
    "COPY x FROM stdin;",
    "TRUNCATE x;",
    "DO $$ BEGIN NULL; END $$;",
    "SELECT vault.create_secret('x');",
  ])
    assert.throws(
      () => reconstructionStatements([{ name: "bad.sql", sql }]),
      /not a declaration|Unsupported/,
    );
});

test("extension creation is safe on the fresh platform without omitting its declaration", () => {
  assert.deepEqual(
    reconstructionStatements([
      {
        name: "extension.sql",
        sql: 'CREATE EXTENSION "pg_graphql" SCHEMA "graphql";',
      },
    ]),
    ['CREATE EXTENSION IF NOT EXISTS "pg_graphql" SCHEMA "graphql"'],
  );
});
