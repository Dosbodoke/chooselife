import * as Linking from "expo-linking";
import * as QueryParams from "expo-auth-session/build/QueryParams";
import * as WebBrowser from "expo-web-browser";
import React, { useContext, useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { makeRedirectUri } from "expo-auth-session";

import { supabase } from "~/lib/supabase";
import { Database } from "~/utils/database.types";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];

// Define the AuthContextValue interface
interface SignInResponse {
  data: User | undefined | null;
  error: Error | undefined;
}

interface SignOutResponse {
  error: any | undefined;
  data: {} | undefined;
}

interface AuthContextValue {
  signIn: (e: string, p: string) => Promise<SignInResponse>;
  signUp: (e: string, p: string, n: string) => Promise<SignInResponse>;
  signOut: () => Promise<SignOutResponse>;
  performOAuth: () => Promise<SignInResponse>;
  user: User | null | undefined;
  profile: Profile | null;
  isLoading: boolean;
}

// Define the Provider component
interface ProviderProps {
  children: React.ReactNode;
}

// Create the AuthContext
const AuthContext = React.createContext<AuthContextValue | undefined>(
  undefined
);

export function AuthProvider(props: React.PropsWithChildren) {
  const [user, setUser] = React.useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);

  const [isLoading, setIsLoading] = React.useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);

  // Handle linking into app from email app.
  const url = Linking.useURL();
  if (url) createSessionFromUrl(url);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.auth.getSession();
      setSession(data.session);
      setUser(data.session?.user || null);
      const { data: authListener } = supabase.auth.onAuthStateChange(
        (_, session) => {
          setSession(session);
          setUser(session?.user || null);

          if (!isLoading) {
            setIsLoading(true);
          }
        }
      );

      return () => {
        authListener!.subscription.unsubscribe();
      };
    })();
  }, []);

  useEffect(
    function getProfile() {
      (async () => {
        if (user) {
          const { data } = await supabase
            .from("profiles")
            .select("*")
            .eq("id", user.id)
            .single();
          if (data) {
            setProfile(data);
            return;
          }
        }
        setProfile(null);
      })();
    },
    [user]
  );

  /**
   *
   * @returns
   */
  const logout = async (): Promise<SignOutResponse> => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      return { error: undefined, data: true };
    } catch (error) {
      return { error, data: undefined };
    } finally {
      setUser(null);
    }
  };
  /**
   *
   * @param email
   * @param password
   * @returns
   */
  const login = async (
    email: string,
    password: string
  ): Promise<SignInResponse> => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;

      setUser(data.user);
      setSession(data.session);
      return { data: user, error: undefined };
    } catch (error) {
      setUser(null);
      setSession(null);
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
  const createAcount = async (
    email: string,
    password: string,
    username: string
  ): Promise<SignInResponse> => {
    try {
      // create the user
      const signUpResp = await supabase.auth.signUp({ email, password });
      if (signUpResp.error) throw signUpResp.error;

      const updateResp = await supabase.auth.updateUser({
        data: { name: username },
      });
      if (updateResp.error) throw updateResp.error;
      updateResp.data.user;

      // set user
      setUser(updateResp.data.user);

      // set session
      setSession(signUpResp.data.session);
      return { data: updateResp.data.user, error: undefined };
    } catch (error) {
      setUser(null);
      setSession(null);
      return { error: error as Error, data: undefined };
    }
  };

  const performOAuth = async (): Promise<SignInResponse> => {
    try {
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
        const session = await createSessionFromUrl(url);
        return { data: session?.user, error: undefined };
      }

      throw new Error("Couldn't create session");
    } catch (error) {
      setUser(null);
      setSession(null);
      return { error: error as Error, data: undefined };
    }
  };

  return (
    <AuthContext.Provider
      value={{
        signIn: login,
        signOut: logout,
        signUp: createAcount,
        performOAuth,
        user,
        profile,
        isLoading,
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
