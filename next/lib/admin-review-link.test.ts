import assert from "node:assert/strict";
import test from "node:test";

import {
  copyViewLink,
  profilePath,
  // Node's native TypeScript runner requires an explicit extension.
  // @ts-expect-error TypeScript resolves the same source file for the web build.
} from "./admin-review-link.ts";

const VIEW =
  "https://chooselife.test/en/admin?member=7f0c&period=2026-08&status=overdue";

test("the copied link is the whole view, query string included", async () => {
  const written: string[] = [];
  const result = await copyViewLink(
    { writeText: async (text: string) => void written.push(text) },
    VIEW,
  );

  assert.equal(result, "copied");
  assert.deepEqual(written, [VIEW]);
});

test("a rejected clipboard write is reported, not swallowed", async () => {
  const result = await copyViewLink(
    {
      writeText: async () => {
        throw new DOMException("Document is not focused.", "NotAllowedError");
      },
    },
    VIEW,
  );

  assert.equal(result, "failed");
});

test("an insecure context without a clipboard fails instead of throwing", async () => {
  assert.equal(await copyViewLink(undefined, VIEW), "failed");
});

test("profile links drop the leading @ but keep the rest of the handle", () => {
  assert.equal(profilePath("@seed_anual_em_dia"), "/profile/seed_anual_em_dia");
  assert.equal(profilePath("no_at"), "/profile/no_at");
  assert.equal(profilePath("@a@b"), "/profile/a@b");
});
