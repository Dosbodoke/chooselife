import * as Linking from "expo-linking";
import * as QueryParams from "expo-auth-session/build/QueryParams";
import * as WebBrowser from "expo-web-browser";
import React, { useContext, useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { makeRedirectUri } from "expo-auth-session";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { supabase } from "~/lib/supabase";
import { Database } from "~/utils/database.types";
import { useStorageState } from "~/hooks/useStorageState";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];

interface SignInResponse {
  data: User | undefined | null;
  error: Error | undefined;
}

interface SignOutResponse {
  error: any | undefined;
  data: {} | undefined;
}

interface AuthContextValue {
  login: (email: string, password: string) => Promise<SignInResponse>;
  signUp: (email: string, password: string) => Promise<SignInResponse>;
  logout: () => Promise<SignOutResponse>;
  performOAuth: () => Promise<SignInResponse>;
  user: User | null | undefined;
  profile: Profile | null;
  session: string | null;
  isLoading: boolean;
}

// Create the AuthContext
const AuthContext = React.createContext<AuthContextValue | undefined>(
  undefined
);

export function AuthProvider(props: React.PropsWithChildren) {
  const [[isLoading, session], setSession] = useStorageState("session");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [user, setUser] = React.useState<User | null>(null);

  // Handle linking into app from email app.
  const url = Linking.useURL();
  if (url) createSessionFromUrl(url);

  useEffect(() => {
    (async () => {
      const storedUser = await AsyncStorage.getItem("user");
      if (storedUser) {
        setUser(JSON.parse(storedUser));
      }
    })();
  }, []);

  const storeUserInAsyncStorage = async (user: User | null) => {
    if (user) {
      await AsyncStorage.setItem("user", JSON.stringify(user));
    } else {
      await AsyncStorage.removeItem("user");
    }
  };

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

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        session,
        isLoading,
        login: async (
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
            await storeUserInAsyncStorage(data.user);

            // Remove metadata, store only the token
            const { user, ...session } = data.session;
            setSession(JSON.stringify(session));
            return { data: user, error: undefined };
          } catch (error) {
            setUser(null);
            await storeUserInAsyncStorage(null);
            setSession(null);
            return { error: error as Error, data: undefined };
          }
        },
        logout: async (): Promise<SignOutResponse> => {
          try {
            const { error } = await supabase.auth.signOut();
            if (error) throw error;
            return { error: undefined, data: true };
          } catch (error) {
            return { error, data: undefined };
          } finally {
            setUser(null);
            await storeUserInAsyncStorage(null);
          }
        },
        signUp: async (
          email: string,
          password: string
        ): Promise<SignInResponse> => {
          try {
            // create the user
            const { data, error } = await supabase.auth.signUp({
              email,
              password,
            });
            if (error) throw error;

            const { user, ...session } = data.session || {};
            if (!user) throw new Error("User session is undefined");
            setSession(JSON.stringify(session));
            setUser(user);
            await storeUserInAsyncStorage(user);

            return { data: user, error: undefined };
          } catch (error) {
            setUser(null);
            setSession(null);
            return { data: undefined, error: error as Error };
          }
        },
        performOAuth: async (): Promise<SignInResponse> => {
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
