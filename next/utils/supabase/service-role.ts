import { createClient } from "@supabase/supabase-js";

import { Database } from "./database.types";

/**
 * Bypasses RLS. Only call it from server code that has already authorized the
 * request, and never pass it to a client component.
 *
 * SUPABASE_SECRET_KEY is an sb_secret_ key named `next_server`, used by this
 * app only, so it can be rotated without touching other backend components.
 */
export function createSupabaseServiceRoleClient() {
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!secretKey) {
    throw new Error("SUPABASE_SECRET_KEY is not set");
  }

  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    secretKey,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
