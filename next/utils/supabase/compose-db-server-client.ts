import { CookieMethods, createServerClient } from "@supabase/ssr";

interface ComposeDbServerClientProps {
  cookieMethods?: () => CookieMethods;
}

/**
 * Creates a server client for the database.
 * You can view the examples: https://supabase.com/docs/guides/auth/server-side/creating-a-client?environment=route-handler#creating-a-client
 */
export const composeDbServerClient = ({
  cookieMethods,
}: ComposeDbServerClientProps) => {
  {
    if (!cookieMethods) {
      throw new Error("cookieMethods are required!");
    }

    const dbServerClient = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: cookieMethods(),
        auth: {
          flowType: "pkce",
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: true,
        },
      }
    );

    return {
      dbServerClient,
    };
  }
};
