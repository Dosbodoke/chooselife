import { assert, assertEquals } from "jsr:@std/assert@1";

import {
  getStorageAvatarKey,
  handleUserSelfDeletion,
  type UserSelfDeletionDeps,
} from "./user-self-deletion.ts";

type Recorded = string[];

type FakeOptions = {
  avatarError?: { message: string };
  deleteUserError?: { message: string };
  profileError?: { message: string };
  profilePicture?: unknown;
  retentionError?: { message: string };
  user?: { id: string } | null;
};

/**
 * Records the order of the side effects, because the order IS the requirement:
 * the association records must be journalled and unlinked before anything is
 * deleted, and nothing may be deleted at all if that step fails.
 */
function fakeDeps(options: FakeOptions = {}) {
  const calls: Recorded = [];
  const user = options.user === undefined ? { id: "user-1" } : options.user;

  const admin = {
    auth: {
      admin: {
        deleteUser: (id: string) => {
          calls.push(`deleteUser:${id}`);
          return Promise.resolve({
            data: { user: null },
            error: options.deleteUserError ?? null,
          });
        },
      },
    },
    rpc: (fn: string, args: { p_user_id: string }) => {
      calls.push(`rpc:${fn}:${args.p_user_id}`);
      return Promise.resolve({ error: options.retentionError ?? null });
    },
    storage: {
      from: (bucket: string) => ({
        remove: (paths: string[]) => {
          calls.push(`storage:${bucket}:${paths.join(",")}`);
          return Promise.resolve({
            data: null,
            error: options.avatarError ?? null,
          });
        },
      }),
    },
  };

  const createUserClient = (authorization: string) => {
    calls.push(`createUserClient:${authorization}`);

    return {
      auth: {
        getUser: () => {
          calls.push("getUser");
          return Promise.resolve({ data: { user }, error: null });
        },
      },
      from: (table: string) => ({
        select: (columns: string) => ({
          eq: (column: string, value: string) => {
            calls.push(`select:${table}:${columns}:${column}=${value}`);
            return Promise.resolve({
              data: options.profileError ? null : [{
                id: value,
                profile_picture: options.profilePicture ?? null,
              }],
              error: options.profileError ?? null,
            });
          },
        }),
      }),
    };
  };

  return {
    calls,
    deps: {
      admin,
      createUserClient,
    } as unknown as UserSelfDeletionDeps,
  };
}

const request = (method = "POST") =>
  new Request("http://localhost/user-self-deletion", {
    headers: { Authorization: "Bearer token" },
    method,
  });

Deno.test("preflight is answered without touching any data", async () => {
  const { calls, deps } = fakeDeps();

  const response = await handleUserSelfDeletion(request("OPTIONS"), deps);

  assertEquals(response.status, 200);
  assertEquals(calls, []);
});

Deno.test("an unauthenticated caller deletes nothing", async () => {
  const { calls, deps } = fakeDeps({ user: null });

  const response = await handleUserSelfDeletion(request(), deps);

  assertEquals(response.status, 401);
  assert(
    !calls.some((call) => call.startsWith("deleteUser")),
    "the auth user must not be deleted without an authenticated caller",
  );
  assert(
    !calls.some((call) => call.startsWith("rpc:")),
    "the retention command must not run without an authenticated caller",
  );
});

Deno.test("the association records are prepared before anything is deleted", async () => {
  const { calls, deps } = fakeDeps({ profilePicture: "avatars/user-1.png" });

  const response = await handleUserSelfDeletion(request(), deps);

  assertEquals(response.status, 200);

  const retentionIndex = calls.indexOf(
    "rpc:prepare_association_account_deletion:user-1",
  );
  const avatarIndex = calls.indexOf("storage:avatars:avatars/user-1.png");
  const deleteUserIndex = calls.indexOf("deleteUser:user-1");

  assert(retentionIndex >= 0, "the retention command must run");
  assert(avatarIndex >= 0, "the stored avatar must be removed");
  assert(deleteUserIndex >= 0, "the auth user must be deleted");
  assert(
    retentionIndex < avatarIndex,
    "retention must be prepared before the avatar is removed",
  );
  assert(
    retentionIndex < deleteUserIndex,
    "retention must be prepared before the auth user is deleted",
  );
});

Deno.test("a failed retention command aborts the deletion entirely", async () => {
  const { calls, deps } = fakeDeps({
    profilePicture: "avatars/user-1.png",
    retentionError: { message: "could not lock the association person" },
  });

  const response = await handleUserSelfDeletion(request(), deps);
  const body = await response.json();

  assertEquals(response.status, 500);
  assert(
    !calls.some((call) => call.startsWith("deleteUser")),
    "the auth user must survive a failed retention command",
  );
  assert(
    !calls.some((call) => call.startsWith("storage:")),
    "the avatar must survive a failed retention command",
  );
  assert(
    !body.error.includes("could not lock the association person"),
    "the internal failure detail must not be returned to the caller",
  );
});

Deno.test("a failed auth deletion is reported instead of being swallowed", async () => {
  const { deps } = fakeDeps({
    deleteUserError: { message: "auth user is locked" },
  });

  const response = await handleUserSelfDeletion(request(), deps);
  const body = await response.json();

  assertEquals(response.status, 400);
  assertEquals(body.error, "auth user is locked");
});

Deno.test("a profile read failure aborts before the retention command", async () => {
  const { calls, deps } = fakeDeps({
    profileError: { message: "profiles unavailable" },
  });

  const response = await handleUserSelfDeletion(request(), deps);

  assertEquals(response.status, 400);
  assert(
    !calls.some((call) => call.startsWith("rpc:")),
    "nothing runs once the profile read failed",
  );
  assert(
    !calls.some((call) => call.startsWith("deleteUser")),
    "the auth user must survive a failed profile read",
  );
});

Deno.test("an account with no avatar deletes without touching storage", async () => {
  const { calls, deps } = fakeDeps({ profilePicture: null });

  const response = await handleUserSelfDeletion(request(), deps);

  assertEquals(response.status, 200);
  assert(
    !calls.some((call) => call.startsWith("storage:")),
    "storage must not be called when there is no stored avatar",
  );
  assert(calls.includes("deleteUser:user-1"));
});

Deno.test("an externally hosted avatar is never deleted from our storage", async () => {
  const { calls, deps } = fakeDeps({
    profilePicture: "https://lh3.googleusercontent.com/a/photo.jpg",
  });

  const response = await handleUserSelfDeletion(request(), deps);

  assertEquals(response.status, 200);
  assert(
    !calls.some((call) => call.startsWith("storage:")),
    "an external avatar URL is not a storage key",
  );
});

Deno.test("an avatar stored as an object is addressed by its name", async () => {
  const { calls, deps } = fakeDeps({
    profilePicture: { name: "avatars/legacy.png" },
  });

  await handleUserSelfDeletion(request(), deps);

  assert(calls.includes("storage:avatars:avatars/legacy.png"));
});

Deno.test("avatar keys are distinguished from external URLs", () => {
  assertEquals(getStorageAvatarKey("avatars/user-1.png"), "avatars/user-1.png");
  assertEquals(getStorageAvatarKey({ name: "avatars/user-1.png" }), "avatars/user-1.png");
  assertEquals(getStorageAvatarKey("https://example.com/a.png"), null);
  assertEquals(getStorageAvatarKey("http://example.com/a.png"), null);
  assertEquals(getStorageAvatarKey({ name: "https://example.com/a.png" }), null);
  assertEquals(getStorageAvatarKey({}), null);
  assertEquals(getStorageAvatarKey(null), null);
});
