import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import { supabaseAdmin } from "../_shared/supabase-admin.ts";
import { createSupabaseClient } from "../_shared/supabase-client.ts";

import {
  handleUserSelfDeletion,
  type UserSelfDeletionDeps,
} from "./user-self-deletion.ts";

// The request handling lives in `./user-self-deletion.ts` so that it can be
// tested without binding a port or constructing real Supabase clients. It
// declares only the client surface it uses; the real clients provide that
// surface, but proving it structurally makes TypeScript walk the whole
// generated `Database` type and give up ("excessively deep"), so the two
// clients are narrowed here at the single wiring site.
Deno.serve((req: Request) =>
  handleUserSelfDeletion(req, {
    admin: supabaseAdmin as unknown as UserSelfDeletionDeps["admin"],
    createUserClient: (authorization: string) =>
      createSupabaseClient(
        authorization,
      ) as unknown as ReturnType<UserSelfDeletionDeps["createUserClient"]>,
  })
);
