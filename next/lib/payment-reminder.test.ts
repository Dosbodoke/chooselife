import assert from "node:assert/strict";
import test from "node:test";

import {
  localizedReminderText,
  reminderBlock,
  reminderFailure,
  // Node's native TypeScript runner requires an explicit extension.
  // @ts-expect-error TypeScript resolves the same source file for the web build.
} from "./payment-reminder.ts";

test("a preview without a blocked reason can be sent", () => {
  assert.equal(reminderBlock({ blocked_reason: null as unknown as string }), null);
  assert.equal(reminderBlock(null), null);
  assert.equal(reminderBlock({ blocked_reason: "cooldown" }), "cooldown");
});

test("an unexpected blocked reason still blocks", () => {
  assert.equal(reminderBlock({ blocked_reason: "something_new" }), "unknown");
});

test("refusals map from the RPC hint, and unknown errors never read as sent", () => {
  assert.equal(reminderFailure({ code: "22023", hint: "no_devices" }), "no_devices");
  assert.equal(reminderFailure({ code: "22023", hint: "cooldown" }), "cooldown");
  assert.equal(reminderFailure({ code: "42501", hint: null }), "unauthorized");
  assert.equal(reminderFailure({ code: "08006" }), "unknown");
});

test("the preview text follows the device language and falls back to Portuguese", () => {
  const body = { pt: "Olá", en: "Hello" };

  assert.equal(localizedReminderText(body, "en"), "Hello");
  assert.equal(localizedReminderText(body, "es"), "Olá");
  assert.equal(localizedReminderText(null, "pt"), "");
});
