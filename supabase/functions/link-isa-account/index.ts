import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import { supabaseAdmin } from "../_shared/supabase-admin.ts";
import { createSupabaseClient } from "../_shared/supabase-client.ts";

import { fetchIsaUserDetails, verifyIsaIdToken } from "./isa.ts";
import {
  handleLinkIsaAccount,
  type LinkIsaAccountDeps,
} from "./link-isa-account.ts";

// See user-self-deletion/index.ts: the clients are narrowed to the surface the
// handler declares so TypeScript does not walk the whole generated `Database`.
Deno.serve((req: Request) =>
  handleLinkIsaAccount(req, {
    admin: supabaseAdmin as unknown as LinkIsaAccountDeps["admin"],
    createUserClient: (authorization: string) =>
      createSupabaseClient(
        authorization,
      ) as unknown as ReturnType<LinkIsaAccountDeps["createUserClient"]>,
    isaClientId: Deno.env.get("ISA_COGNITO_CLIENT_ID"),
    verifyIdToken: verifyIsaIdToken,
    fetchUserDetails: (idToken) => fetchIsaUserDetails(idToken),
  })
);
