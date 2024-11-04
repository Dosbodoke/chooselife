import * as Linking from "expo-linking";
import * as QueryParams from "expo-auth-session/build/QueryParams";
import * as WebBrowser from "expo-web-browser";
import React, { useContext, useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { AuthError, makeRedirectUri } from "expo-auth-session";
import type { Session } from "@supabase/supabase-js";

import { supabase } from "~/lib/supabase";
import { Database } from "~/utils/database.types";
import { useRouter } from "expo-router";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];

// interface SignInResponse {
//   data: User | undefined | null;
//   error: Error | undefined;
// }

// interface SignOutResponse {
//   error: any | undefined;
//   data: {} | undefined;
// }

type AuthMethodResponse = Promise<
  { success: true } | { success: false; errorMessage?: string }
>;

interface AuthContextValue {
  login: (email: string, password: string) => AuthMethodResponse;
  signUp: (email: string, password: string) => AuthMethodResponse;
  logout: () => AuthMethodResponse;
  performOAuth: (method: "apple" | "google") => AuthMethodResponse;
  profile: Profile | null;
  session: Session | null;
}

// Create the AuthContext
const AuthContext = React.createContext<AuthContextValue | undefined>(
  undefined
);

export function AuthProvider(props: React.PropsWithChildren) {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });
  }, []);

  // Handle linking into app from email app.
  const url = Linking.useURL();
  if (url) createSessionFromUrl(url);

  const getUserProfile = async () => {
    console.log({ session });
    if (session) {
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", session.user.id)
        .single();

      if (data?.username) {
        setProfile(data);
      } else {
        // Navigate user to the screen where he will set the profile
        router.replace("/setProfile");
      }
    }
  };

  useEffect(() => {
    getUserProfile();
  }, [session]);

  return (
    <AuthContext.Provider
      value={{
        profile,
        session,
        login: async (email: string, password: string) => {
          try {
            const { error } = await supabase.auth.signInWithPassword({
              email,
              password,
            });
            if (error) throw error;
            return { success: true };
          } catch (error) {
            if (error instanceof AuthError) {
              return { success: false, errorMessage: error.message };
            }
            return { success: false };
          }
        },
        logout: async () => {
          try {
            const { error } = await supabase.auth.signOut();
            if (error) throw error;
            return { success: true };
          } catch (error) {
            if (error instanceof AuthError) {
              return { success: true, errorMessage: error.message };
            }
            return { success: false };
          }
        },
        signUp: async (email: string, password: string) => {
          try {
            const { error } = await supabase.auth.signUp({
              email,
              password,
            });
            if (error) throw error;
            return { success: true };
          } catch (error) {
            if (error instanceof AuthError) {
              return { success: true, errorMessage: error.message };
            }
            return { success: false };
          }
        },
        performOAuth: async (method: "apple" | "google") => {
          try {
            const redirectTo = makeRedirectUri();

            const { data, error } = await supabase.auth.signInWithOAuth({
              provider: method,
              options: {
                redirectTo,
                skipBrowserRedirect: true,
              },
            });

            if (error) throw error;

            const res = await WebBrowser.openAuthSessionAsync(
              data?.url ?? "",
              redirectTo
            );

            if (res.type === "success") {
              const { url } = res;
              await createSessionFromUrl(url);
              return { success: true };
            }

            throw new Error("Couldn't create session");
          } catch (error) {
            if (error instanceof AuthError) {
              return { success: true, errorMessage: error.message };
            }
            return { success: false };
          }
        },
      }}
    >
      {props.children}
    </AuthContext.Provider>
  );
}

// Define the useAuth hook
export const useAuth = () => {
  const authContext = useContext(AuthContext);

  if (!authContext) {
    throw new Error("useAuth must be used within an AuthContextProvider");
  }

  return authContext;
};

const createSessionFromUrl = async (url: string) => {
  const { params, errorCode } = QueryParams.getQueryParams(url);

  if (errorCode) throw new Error(errorCode);
  const { access_token, refresh_token } = params;

  if (!access_token) return;

  const { data, error } = await supabase.auth.setSession({
    access_token,
    refresh_token,
  });
  if (error) throw error;
  return data.session;
};
