import { corsHeaders } from "../_shared/cors.ts";

import type { IsaIdentity, IsaUserDetails } from "./isa.ts";

/**
 * Links the caller's profile to the ISA account they just signed in to.
 *
 * The app runs the ISA sign-in (authorization code + PKCE) and sends the
 * resulting ISA ID token here. Nothing the client says about the ISA account is
 * trusted: the token is verified against the ISA pool and Choose Life's client
 * ID, and the ISA ID is read from the ISA account API with that same token.
 * Only then is the link written, with the service role, because clients have
 * no write grant on `profile_isa_accounts`.
 */

type ClientError = { code?: string; message: string };

export type IsaLink = {
  profile_id: string;
  isa_id: string;
  isa_name: string | null;
  linked_at: string;
};

/**
 * Only the surface this handler actually uses is described, structurally, so
 * that neither this module nor its test needs the `@supabase` import map to
 * resolve. The real clients satisfy it; `index.ts` wires them in.
 */
type UserClient = {
  auth: {
    getUser: () => PromiseLike<{ data: { user: { id: string } | null } }>;
  };
};

type AdminClient = {
  from: (table: "profile_isa_accounts") => {
    upsert: (
      row: IsaLink & { cognito_sub: string },
      options: { onConflict: "profile_id" },
    ) => {
      select: (columns: string) => {
        single: () => PromiseLike<{
          data: IsaLink | null;
          error: ClientError | null;
        }>;
      };
    };
  };
};

export type LinkIsaAccountDeps = {
  admin: AdminClient;
  createUserClient: (authorization: string) => UserClient;
  isaClientId: string | undefined;
  verifyIdToken: (idToken: string, clientId: string) => Promise<IsaIdentity>;
  fetchUserDetails: (idToken: string) => Promise<IsaUserDetails>;
  now?: () => Date;
};

const UNIQUE_VIOLATION = "23505";

const jsonResponse = (body: unknown, status: number) =>
  new Response(JSON.stringify(body, null, 2), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status,
  });

const fullName = ({ name, surname }: IsaUserDetails) =>
  [name, surname].filter(Boolean).join(" ") || null;

const readIdToken = async (req: Request) => {
  try {
    const body = await req.json();
    return typeof body?.idToken === "string" && body.idToken
      ? body.idToken as string
      : null;
  } catch {
    return null;
  }
};

export async function handleLinkIsaAccount(
  req: Request,
  deps: LinkIsaAccountDeps,
): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed." }, 405);
  }

  if (!deps.isaClientId) {
    return jsonResponse({ error: "ISA account linking is not enabled." }, 503);
  }

  try {
    const { data: { user } } = await deps.createUserClient(
      req.headers.get("Authorization") ?? "",
    ).auth.getUser();

    if (!user) {
      return jsonResponse({ error: "Authentication is required." }, 401);
    }

    const idToken = await readIdToken(req);
    if (!idToken) {
      return jsonResponse({ error: "An ISA ID token is required." }, 400);
    }

    let identity: IsaIdentity;
    try {
      identity = await deps.verifyIdToken(idToken, deps.isaClientId);
    } catch (error) {
      console.error("Rejected ISA ID token: " + String(error));
      return jsonResponse(
        { error: "The ISA sign-in could not be verified." },
        401,
      );
    }

    let details: IsaUserDetails;
    try {
      details = await deps.fetchUserDetails(idToken);
    } catch (error) {
      console.error("ISA account API failed: " + String(error));
      return jsonResponse(
        { error: "The ISA account service is unavailable." },
        502,
      );
    }

    const { data: link, error } = await deps.admin
      .from("profile_isa_accounts")
      .upsert({
        profile_id: user.id,
        isa_id: details.isaId,
        cognito_sub: identity.sub,
        isa_name: fullName(details),
        linked_at: (deps.now?.() ?? new Date()).toISOString(),
      }, { onConflict: "profile_id" })
      .select("profile_id, isa_id, isa_name, linked_at")
      .single();

    if (error?.code === UNIQUE_VIOLATION) {
      return jsonResponse(
        { error: "This ISA account is already linked to another profile." },
        409,
      );
    }
    if (error) throw new Error(error.message);

    return jsonResponse(link, 200);
  } catch (error) {
    const message = error instanceof Error
      ? error.message
      : "The ISA account could not be linked.";
    console.error(message);

    return jsonResponse({ error: message }, 500);
  }
}
