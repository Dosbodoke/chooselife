import { assertEquals } from "jsr:@std/assert@1";

import { fetchIsaUserDetails } from "./isa.ts";
import {
  handleLinkIsaAccount,
  type LinkIsaAccountDeps,
} from "./link-isa-account.ts";

type FakeOptions = {
  clientId?: string;
  detailsError?: Error;
  tokenError?: Error;
  upsertError?: { code?: string; message: string };
  user?: { id: string } | null;
};

const NOW = new Date("2026-10-15T12:00:00.000Z");

function fakeDeps(options: FakeOptions = {}) {
  const upserts: unknown[] = [];
  const verified: string[] = [];
  const user = options.user === undefined ? { id: "profile-1" } : options.user;

  const deps: LinkIsaAccountDeps = {
    admin: {
      from: () => ({
        upsert: (row, upsertOptions) => {
          upserts.push({ row, upsertOptions });
          return {
            select: () => ({
              single: () =>
                Promise.resolve(
                  options.upsertError
                    ? { data: null, error: options.upsertError }
                    : {
                      data: {
                        profile_id: row.profile_id,
                        isa_id: row.isa_id,
                        isa_name: row.isa_name,
                        linked_at: row.linked_at,
                      },
                      error: null,
                    },
                ),
            }),
          };
        },
      }),
    },
    createUserClient: () => ({
      auth: { getUser: () => Promise.resolve({ data: { user } }) },
    }),
    isaClientId: "clientId" in options ? options.clientId : "chooselife-client",
    verifyIdToken: (idToken, clientId) => {
      verified.push(`${idToken}@${clientId}`);
      return options.tokenError
        ? Promise.reject(options.tokenError)
        : Promise.resolve({ sub: "cognito-sub-1" });
    },
    fetchUserDetails: () =>
      options.detailsError
        ? Promise.reject(options.detailsError)
        : Promise.resolve({
          isaId: "ISA_1A2B3C4D",
          name: "Ada",
          surname: "Lines",
        }),
    now: () => NOW,
  };

  return { deps, upserts, verified };
}

const post = (body: unknown) =>
  new Request("http://localhost/link-isa-account", {
    method: "POST",
    headers: { Authorization: "Bearer supabase-jwt" },
    body: JSON.stringify(body),
  });

Deno.test("links the verified ISA account to the caller's profile", async () => {
  const { deps, upserts, verified } = fakeDeps();

  const response = await handleLinkIsaAccount(
    post({ idToken: "isa-id-token" }),
    deps,
  );

  assertEquals(response.status, 200);
  assertEquals(await response.json(), {
    profile_id: "profile-1",
    isa_id: "ISA_1A2B3C4D",
    isa_name: "Ada Lines",
    linked_at: NOW.toISOString(),
  });
  assertEquals(verified, ["isa-id-token@chooselife-client"]);
  assertEquals(upserts, [{
    row: {
      profile_id: "profile-1",
      isa_id: "ISA_1A2B3C4D",
      cognito_sub: "cognito-sub-1",
      isa_name: "Ada Lines",
      linked_at: NOW.toISOString(),
    },
    upsertOptions: { onConflict: "profile_id" },
  }]);
});

Deno.test("is disabled until ISA issues a client ID", async () => {
  const { deps, upserts } = fakeDeps({ clientId: undefined });

  const response = await handleLinkIsaAccount(post({ idToken: "t" }), deps);

  assertEquals(response.status, 503);
  assertEquals(upserts, []);
});

Deno.test("requires a Choose Life session", async () => {
  const { deps, upserts } = fakeDeps({ user: null });

  const response = await handleLinkIsaAccount(post({ idToken: "t" }), deps);

  assertEquals(response.status, 401);
  assertEquals(upserts, []);
});

Deno.test("requires an ISA ID token", async () => {
  const { deps, upserts } = fakeDeps();

  const response = await handleLinkIsaAccount(post({}), deps);

  assertEquals(response.status, 400);
  assertEquals(upserts, []);
});

Deno.test("writes nothing when the ISA token does not verify", async () => {
  const { deps, upserts } = fakeDeps({ tokenError: new Error("bad aud") });

  const response = await handleLinkIsaAccount(post({ idToken: "t" }), deps);

  assertEquals(response.status, 401);
  assertEquals(upserts, []);
});

Deno.test("writes nothing when the ISA account API fails", async () => {
  const { deps, upserts } = fakeDeps({ detailsError: new Error("down") });

  const response = await handleLinkIsaAccount(post({ idToken: "t" }), deps);

  assertEquals(response.status, 502);
  assertEquals(upserts, []);
});

Deno.test("refuses an ISA account already linked elsewhere", async () => {
  const { deps } = fakeDeps({
    upsertError: { code: "23505", message: "duplicate key" },
  });

  const response = await handleLinkIsaAccount(post({ idToken: "t" }), deps);

  assertEquals(response.status, 409);
});

Deno.test("reads the ISA ID with the member's own token", async () => {
  const requests: Request[] = [];
  const fetchImpl = (input: RequestInfo | URL, init?: RequestInit) => {
    requests.push(new Request(input, init));
    return Promise.resolve(
      Response.json({
        isaId: "ISA_1A2B3C4D",
        name: "Ada",
        surname: "Lines",
        email: "ada@example.com",
      }),
    );
  };

  const details = await fetchIsaUserDetails("isa-id-token", fetchImpl);

  assertEquals(details, {
    isaId: "ISA_1A2B3C4D",
    name: "Ada",
    surname: "Lines",
  });
  assertEquals(
    requests[0].url,
    "https://account-api.slacklineinternational.org/basic/userDetails",
  );
  assertEquals(
    requests[0].headers.get("Authorization"),
    "Bearer isa-id-token",
  );
});
