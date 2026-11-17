import { createClient } from "@supabase/supabase-js";

import { Database } from "./database.types";

/**
 * Bypasses RLS. Only call it from server code that has already authorized the
 * request, and never pass it to a client component.
 */
export function createSupabaseServiceRoleClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");
  }

  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
