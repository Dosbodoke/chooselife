import { corsHeaders } from "../_shared/cors.ts";

/**
 * Deleting a Choose Life account does NOT delete the formal association record.
 * The exact submitted SL.A.C revision snapshot, the membership periods, the
 * payment obligations, the claims, the payer assertion and the decision audit
 * are all retained, and once the account is gone they are readable only by
 * authorized association admins.
 *
 * `prepare_association_account_deletion` is what makes that safe: it journals
 * any still-active membership as a closure, drops the membership
 * authorization, deactivates the contribution schedules and severs the account
 * link, without deleting a single formal row. It is service-role only.
 *
 * Nothing may be deleted before it succeeds. If it failed and we carried on,
 * the account would be gone while the association lost both its authorization
 * trail and its link to the subject.
 */

type ProfilePicture = string | { name?: unknown } | null;

type ClientError = { message: string };

/**
 * Only the surface this handler actually uses is described, structurally, so
 * that neither this module nor its test needs the `@supabase` import map to
 * resolve. The real clients satisfy it; `index.ts` wires them in.
 */
type UserClient = {
  auth: {
    getUser: () => PromiseLike<{ data: { user: { id: string } | null } }>;
  };
  from: (table: "profiles") => {
    select: (columns: string) => {
      eq: (
        column: "id",
        value: string,
      ) => PromiseLike<{
        data: { profile_picture: unknown }[] | null;
        error: ClientError | null;
      }>;
    };
  };
};

type AdminClient = {
  auth: {
    admin: {
      deleteUser: (
        id: string,
      ) => PromiseLike<{ data: unknown; error: ClientError | null }>;
    };
  };
  rpc: (
    fn: "prepare_association_account_deletion",
    args: { p_user_id: string },
  ) => PromiseLike<{ error: ClientError | null }>;
  storage: {
    from: (bucket: "avatars") => {
      remove: (
        paths: string[],
      ) => PromiseLike<{ data: unknown; error: ClientError | null }>;
    };
  };
};

export type UserSelfDeletionDeps = {
  admin: AdminClient;
  createUserClient: (authorization: string) => UserClient;
};

const jsonResponse = (body: unknown, status: number) =>
  new Response(JSON.stringify(body, null, 2), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status,
  });

/** An external avatar URL is not ours to delete; a storage key is. */
export function getStorageAvatarKey(profilePicture: ProfilePicture) {
  if (!profilePicture) return null;

  const candidate = typeof profilePicture === "string"
    ? profilePicture
    : typeof profilePicture.name === "string"
    ? profilePicture.name
    : null;

  if (!candidate) return null;
  if (/^https?:\/\//.test(candidate)) return null;

  return candidate;
}

export async function handleUserSelfDeletion(
  req: Request,
  deps: UserSelfDeletionDeps,
): Promise<Response> {
  // This is needed if you're planning to invoke your function from a browser.
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseClient = deps.createUserClient(
      req.headers.get("Authorization") ?? "",
    );

    const { data: { user } } = await supabaseClient.auth.getUser();

    if (!user) {
      return jsonResponse({ error: "Authentication is required." }, 401);
    }

    const { data: profiles, error: profileError } = await supabaseClient
      .from("profiles")
      .select("id, profile_picture")
      .eq("id", user.id);

    if (profileError) throw new Error(profileError.message);

    // Retention first: no profile, avatar or auth row is touched until the
    // association side has journalled the closure and severed the link.
    const { error: retentionError } = await deps.admin.rpc(
      "prepare_association_account_deletion",
      { p_user_id: user.id },
    );

    if (retentionError) {
      console.error(
        "Aborted account deletion: the association records could not be prepared: " +
          retentionError.message,
      );

      return jsonResponse(
        {
          error:
            "Could not preserve the association records for this account, so nothing was deleted. Please try again.",
        },
        500,
      );
    }

    const avatarKey = getStorageAvatarKey(
      (profiles?.[0]?.profile_picture ?? null) as ProfilePicture,
    );

    if (avatarKey) {
      const { data: avatarDeletion, error: avatarError } = await deps.admin
        .storage
        .from("avatars")
        .remove([avatarKey]);

      if (avatarError) throw new Error(avatarError.message);
      console.log(
        "Avatar deleted: " + JSON.stringify(avatarDeletion, null, 2),
      );
    }

    // Deleting the auth user nulls `user_id` on every retained formal record
    // (ON DELETE SET NULL) instead of cascading it away.
    const { data: deletionData, error: deletionError } = await deps.admin.auth
      .admin.deleteUser(user.id);

    if (deletionError) throw new Error(deletionError.message);
    console.log("User & files deleted user_id: " + user.id);

    return jsonResponse(deletionData, 200);
  } catch (error) {
    const message = error instanceof Error
      ? error.message
      : "The account could not be deleted.";
    console.error(message);

    return jsonResponse({ error: message }, 400);
  }
}
