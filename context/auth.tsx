import * as Linking from "expo-linking";
import * as QueryParams from "expo-auth-session/build/QueryParams";
import * as WebBrowser from "expo-web-browser";
import React, { useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { makeRedirectUri } from "expo-auth-session";

import { supabase } from "~/lib/supabase";
import { Database } from "~/utils/database.types";

const AuthContext = React.createContext<{
  signIn: (
    email: string,
    password: string
  ) => Promise<SignInResponse> | undefined;
  performOAuth: () => void;
  signUp: (
    email: string,
    password: string,
    name?: string
  ) => Promise<SignInResponse> | undefined;
  signOut: () => void;
  isLoading: boolean;
  user?: User | undefined;
}>({
  signIn: () => undefined,
  performOAuth: () => undefined,
  signUp: () => undefined,
  signOut: () => null,
  isLoading: false,
  user: undefined,
});

export function SessionProvider(props: React.PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [user, setUser] = useState<User | undefined>(undefined);
  const [profile, setProfile] =
    useState<Database["public"]["Tables"]["profiles"]["Row"]>();

  // Handle linking into app from email app.
  const url = Linking.useURL();
  if (url) createSessionFromUrl(url);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    supabase.auth.onAuthStateChange((e, session) => {
      setSession(session);
    });
  }, []);

  useEffect(() => {
    /**
     * Get the user
     */
    async function init() {
      try {
        const response = await supabase.auth.getUser();
        if (response.data.user) {
          setUser(response.data.user);
        }
        return response?.data?.user;
      } finally {
        setIsLoading(false);
      }
    }
    init();
  }, []);

  return (
    <AuthContext.Provider
      value={{
        signIn: async (email: string, password: string) => {
          // Perform sign-in logic here
          const response = await login(email, password);
          if (response.data) {
            setUser(response.data);
          }
          setIsLoading(false);
          return response;
        },
        performOAuth: performOAuth,
        signUp: async (email: string, password: string, name?: string) => {
          // Perform sign-up logic here
          const response = await createAcount(email, password, name!);
          if (response.data) {
            setUser(response.data);
          }
          setIsLoading(false);
          return response;
        },
        signOut: async () => {
          // Perform sign-out logic here
          await logout();
          setUser(undefined);
          setIsLoading(false);
        },
        isLoading,
        user,
      }}
    >
      {props.children}
    </AuthContext.Provider>
  );
}

// This hook can be used to access the user info.
export function useSession() {
  const value = React.useContext(AuthContext);
  if (process.env.NODE_ENV !== "production") {
    if (!value) {
      throw new Error("useSession must be wrapped in a <SessionProvider />");
    }
  }

  return value;
}

export interface SignInResponse {
  data: User | undefined;
  error: Error | undefined;
}

export interface SignOutResponse {
  error: any | undefined;
  data: {} | undefined;
}

/**
 *
 * @param email
 * @param password
 * @returns
 */
export const login = async (
  email: string,
  password: string
): Promise<SignInResponse> => {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
    return { data: data?.user, error: undefined };
  } catch (error) {
    return { error: error as Error, data: undefined };
  }
};

/**
 *
 * @param email
 * @param password
 * @param username
 * @returns
 */
export const createAcount = async (
  email: string,
  password: string,
  username: string
): Promise<SignInResponse> => {
  try {
    let { error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) throw error;

    const { data, error: updateErr } = await supabase.auth.updateUser({
      data: { username },
    });
    if (updateErr) throw updateErr;

    return { data: data?.user as User, error: undefined };
  } catch (error) {
    return { error: error as Error, data: undefined };
  }
};

/**
 *
 * @returns
 */
export const logout = async (): Promise<SignOutResponse> => {
  try {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    return { error: undefined, data: true };
  } catch (error) {
    return { error, data: undefined };
  } finally {
  }
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

const performOAuth = async () => {
  const redirectTo = makeRedirectUri();

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
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
  }
};
