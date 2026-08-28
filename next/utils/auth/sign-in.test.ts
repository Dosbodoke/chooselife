import assert from "node:assert/strict";
import test from "node:test";

// Node's native TypeScript runner requires an explicit extension.
// prettier-ignore
// @ts-expect-error TypeScript resolves the same source file for the web build.
import { refreshAfterPasswordSignIn, signInWithEmailPassword } from "./sign-in.ts";

test("signs in with an email and password instead of sending an OTP", async () => {
  const calls: Array<{ email: string; password: string }> = [];
  const auth = {
    signInWithPassword: async (credentials: {
      email: string;
      password: string;
    }) => {
      calls.push(credentials);
      return { error: null };
    },
  };

  const result = await signInWithEmailPassword(auth, {
    email: "juangabriel4699@gmail.com",
    password: "secret-password",
  });

  assert.deepEqual(calls, [
    {
      email: "juangabriel4699@gmail.com",
      password: "secret-password",
    },
  ]);
  assert.deepEqual(result, { success: true });
});

test("returns a stable error reason for invalid credentials", async () => {
  const auth = {
    signInWithPassword: async () => ({
      error: { code: "invalid_credentials" },
    }),
  };

  const result = await signInWithEmailPassword(auth, {
    email: "juangabriel4699@gmail.com",
    password: "wrong-password",
  });

  assert.deepEqual(result, {
    success: false,
    reason: "invalid_credentials",
  });
});

test("does not expose unexpected Supabase errors to the login form", async () => {
  const auth = {
    signInWithPassword: async () => ({
      error: { code: "unexpected_failure", message: "internal detail" },
    }),
  };

  const result = await signInWithEmailPassword(auth, {
    email: "juangabriel4699@gmail.com",
    password: "secret-password",
  });

  assert.deepEqual(result, { success: false, reason: "unknown" });
});

test("waits for the login modal URL update before refreshing authenticated content", async () => {
  const calls: string[] = [];
  let finishClosingModal: (() => void) | undefined;
  const modalClosed = new Promise<void>((resolve) => {
    finishClosingModal = resolve;
  });

  const refreshPromise = refreshAfterPasswordSignIn({
    closeLoginModal: async () => {
      calls.push("close-started");
      await modalClosed;
      calls.push("close-finished");
    },
    refresh: () => {
      calls.push("refresh");
    },
  });

  await Promise.resolve();
  assert.deepEqual(calls, ["close-started"]);

  finishClosingModal?.();
  await refreshPromise;

  assert.deepEqual(calls, ["close-started", "close-finished", "refresh"]);
});
