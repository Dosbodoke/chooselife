import assert from "node:assert/strict";
import test from "node:test";

import {
  profilePictureUrl,
  R2_PUBLIC_URL,
  // Node's native TypeScript runner requires an explicit extension.
  // @ts-expect-error TypeScript resolves the same source file for the web build.
} from "./r2.ts";

test("an uploaded picture's R2 key resolves to the avatars bucket on the CDN", () => {
  assert.equal(
    profilePictureUrl("d5117701-59a9-45f4-ad1d-30cbebd7f4b1/1777850835984.jpg"),
    `${R2_PUBLIC_URL}/avatars/d5117701-59a9-45f4-ad1d-30cbebd7f4b1/1777850835984.jpg`,
  );
});

test("a leading slash on the key does not double up in the URL", () => {
  assert.equal(
    profilePictureUrl("/abc/1.jpg"),
    `${R2_PUBLIC_URL}/avatars/abc/1.jpg`,
  );
});

test("a Google sign-in picture is already a full URL and passes through", () => {
  const google = "https://lh3.googleusercontent.com/a/ACg8ocK=s96-c";
  assert.equal(profilePictureUrl(google), google);
});

test("no picture stays empty so callers can fall back to initials", () => {
  assert.equal(profilePictureUrl(null), null);
  assert.equal(profilePictureUrl(undefined), null);
  assert.equal(profilePictureUrl(""), null);
});
