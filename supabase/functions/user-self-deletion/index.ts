import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2.49.8";
import { corsHeaders } from "../_shared/cors.ts";

import { supabaseAdmin } from "../_shared/supabase-admin.ts";
import { createSupabaseClient } from "../_shared/supabase-client.ts";

Deno.serve(async (req: Request) => {
  // This is needed if you're planning to invoke your function from a browser.
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  try {
    const supabaseClient = createSupabaseClient(req.headers.get("Authorization")!,)

    // Now we can get the session or user object
    const {
      data: { user },
    } = await supabaseClient.auth.getUser();
    // And we can run queries in the context of our authenticated user
    const { data: profiles, error: profileError } = await supabaseClient.from(
      "profiles",
    ).select("id, profile_picture").eq("id", user?.id);
    if (!user || profileError) throw profileError;

    // Delete avatar from storage if exists and is not an external URL
    if (profiles.length > 0 && profiles[0].profile_picture) {
      const profilePicture = profiles[0].profile_picture;

      // Check if profile_picture is a URL string or an object with a URL name
      const isExternalUrl = typeof profilePicture === "string"
        ? /^https?:\/\//.test(profilePicture)
        : (typeof profilePicture.name === "string" &&
          /^https?:\/\//.test(profilePicture.name));

      // Only proceed with deletion if it's a storage object (not an external URL)
      if (!isExternalUrl) {
        // Get the file name to delete - handle both string and object formats
        const fileName = typeof profilePicture === "string"
          ? profilePicture
          : (profilePicture.name || null);

        // Only delete if we have a valid file name
        if (fileName) {
          const { data: avatar_deletion, error: avatar_error } =
            await supabaseAdmin
              .storage
              .from("avatars")
              .remove([fileName]);

          if (avatar_error) throw avatar_error;
          console.log(
            "Avatar deleted: " + JSON.stringify(avatar_deletion, null, 2),
          );
        }
      }
    }

    // Delete the USER using the auth API
    const { data: deletion_data, error: deletion_error } = await supabaseAdmin
      .auth.admin.deleteUser(user.id);
    if (deletion_error) throw deletion_error;
    console.log("User & files deleted user_id: " + user.id);

    return new Response(
      JSON.stringify(deletion_data, null, 2),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      },
    );
  } catch (error) {
    console.error(error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
