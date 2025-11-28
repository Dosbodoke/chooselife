import type { Database } from "./database.types.ts";
import { createClient } from "@supabase";

export const supabaseAdmin = createClient<Database>(
  Deno.env.get("SUPABASE_URL") as string,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") as string,
);
