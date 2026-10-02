import assert from "node:assert/strict";
import test from "node:test";

// Node's native TypeScript runner requires an explicit extension.
// prettier-ignore
// @ts-expect-error TypeScript resolves the same source file for the web build.
import { HIGHLINE_BEGINNER_GUIDE_CONTENT_DISPOSITION, HIGHLINE_BEGINNER_GUIDE_CONTENT_TYPE, HIGHLINE_BEGINNER_GUIDE_URL_TTL_SECONDS, resolveHighlineBeginnerAccess } from "./highline-beginner-access.ts";

const request = (authorization?: string) =>
  new Request("https://chooselife.club/api/courses/highline-beginner/access", {
    headers: authorization ? { Authorization: authorization } : undefined,
  });

test("rejects a request without a bearer token before checking Supabase", async () => {
  let authenticateCalls = 0;

  const result = await resolveHighlineBeginnerAccess(request(), {
    authenticate: async () => {
      authenticateCalls += 1;
      return { id: "user-1" };
    },
    hasEntitlement: async () => true,
    signDocument: async () => "https://example.com/document.pdf",
  });

  assert.deepEqual(result, {
    status: 401,
    body: { error: "Unauthorized" },
  });
  assert.equal(authenticateCalls, 0);
});

test("returns the same unauthorized response for an invalid bearer token", async () => {
  const result = await resolveHighlineBeginnerAccess(
    request("Bearer invalid-token"),
    {
      authenticate: async () => null,
      hasEntitlement: async () => true,
      signDocument: async () => "https://example.com/document.pdf",
    }
  );

  assert.deepEqual(result, {
    status: 401,
    body: { error: "Unauthorized" },
  });
});

test("returns entitlement_required without signing when the user has no row", async () => {
  let signCalls = 0;

  const result = await resolveHighlineBeginnerAccess(
    request("Bearer valid-token"),
    {
      authenticate: async (token) => {
        assert.equal(token, "valid-token");
        return { id: "user-1" };
      },
      hasEntitlement: async (token, userId) => {
        assert.equal(token, "valid-token");
        assert.equal(userId, "user-1");
        return false;
      },
      signDocument: async () => {
        signCalls += 1;
        return "https://example.com/document.pdf";
      },
    }
  );

  assert.deepEqual(result, {
    status: 403,
    body: {
      code: "entitlement_required",
      error: "Course access required",
    },
  });
  assert.equal(signCalls, 0);
});

test("signs an entitled guide request with a five-minute inline PDF contract", async () => {
  let signInput: {
    contentDisposition: string;
    contentType: string;
    expiresIn: number;
  } | null = null;
  const now = Date.parse("2026-09-14T23:00:00.000Z");

  const result = await resolveHighlineBeginnerAccess(
    request("Bearer valid-token"),
    {
      authenticate: async () => ({ id: "user-1" }),
      hasEntitlement: async () => true,
      signDocument: async (input) => {
        signInput = input;
        return "https://private.example.com/signed-guide";
      },
      now: () => now,
    }
  );

  assert.deepEqual(signInput, {
    contentDisposition: HIGHLINE_BEGINNER_GUIDE_CONTENT_DISPOSITION,
    contentType: HIGHLINE_BEGINNER_GUIDE_CONTENT_TYPE,
    expiresIn: HIGHLINE_BEGINNER_GUIDE_URL_TTL_SECONDS,
  });
  assert.deepEqual(result, {
    status: 200,
    body: {
      documentUrl: "https://private.example.com/signed-guide",
      expiresAt: "2026-09-14T23:05:00.000Z",
    },
  });
});

test("hides entitlement and signing failures behind a stable server error", async () => {
  const entitlementFailure = await resolveHighlineBeginnerAccess(
    request("Bearer valid-token"),
    {
      authenticate: async () => ({ id: "user-1" }),
      hasEntitlement: async () => {
        throw new Error("database details");
      },
      signDocument: async () => "unused",
    }
  );
  const signingFailure = await resolveHighlineBeginnerAccess(
    request("Bearer valid-token"),
    {
      authenticate: async () => ({ id: "user-1" }),
      hasEntitlement: async () => true,
      signDocument: async () => {
        throw new Error("R2 details");
      },
    }
  );

  assert.deepEqual(entitlementFailure, {
    status: 500,
    body: { error: "Internal server error" },
  });
  assert.deepEqual(signingFailure, {
    status: 500,
    body: { error: "Internal server error" },
  });
});
