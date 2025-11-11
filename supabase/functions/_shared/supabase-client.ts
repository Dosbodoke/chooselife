import type { Database } from "./database.types.ts";
import { createClient } from "@supabase";

export function createSupabaseClient(authorization = "") {
  return createClient<Database>(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? "",
    {
      global: {
        headers: { Authorization: authorization },
      },
    },
  );
}
