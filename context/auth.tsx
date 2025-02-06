import type { Session } from '@supabase/supabase-js';
import { AuthError, makeRedirectUri } from 'expo-auth-session';
import * as QueryParams from 'expo-auth-session/build/QueryParams';
import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import React, { useContext, useEffect, useState } from 'react';

import { useProfile, type Profile } from '~/hooks/use-profile';
import { supabase } from '~/lib/supabase';

type AuthMethodResponse = Promise<
  { success: true } | { success: false; errorMessage?: string }
>;

interface AuthContextValue {
  login: (email: string, password: string) => AuthMethodResponse;
  signUp: (email: string, password: string) => AuthMethodResponse;
  logout: () => AuthMethodResponse;
  performOAuth: (method: 'apple' | 'google') => AuthMethodResponse;
  profile: Profile | null;
  session: Session | null;
  loading: boolean;
}

// Create the AuthContext
const AuthContext = React.createContext<AuthContextValue | undefined>(
  undefined,
);

export function AuthProvider(props: React.PropsWithChildren) {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const { data: profile, isPending: profilePending } = useProfile(
    session?.user.id,
  );

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });
  }, []);

  // Handle linking into app from email app.
  const url = Linking.useURL();
  if (url) createSessionFromUrl(url);

  useEffect(() => {
    if (!profilePending && !profile?.username) {
      router.replace('/setProfile');
    }
  }, [profile]);

  return (
    <AuthContext.Provider
      value={{
        profile: profile || null,
        session,
        loading,
        login: async (email: string, password: string) => {
          try {
            const { error } = await supabase.auth.signInWithPassword({
              email,
              password,
            });
            if (error) throw error;
            return { success: true };
          } catch (error) {
            if ((error as AuthError).code === 'invalid_credentials') {
              return { success: false, errorMessage: 'Credenciais inválidas' };
            }
            return {
              success: false,
              errorMessage: 'Erro no login. Por favor tente novamente.',
            };
          }
        },
        logout: async () => {
          try {
            const { error } = await supabase.auth.signOut();
            if (error) throw error;
            return { success: true };
          } catch (error) {
            if (error instanceof AuthError) {
              return { success: false, errorMessage: error.message };
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
              return { success: false, errorMessage: error.message };
            }
            return { success: false };
          }
        },
        performOAuth: async (method: 'apple' | 'google') => {
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
              data?.url ?? '',
              redirectTo,
            );

            if (res.type === 'success') {
              const { url } = res;
              await createSessionFromUrl(url);
              return { success: true };
            }

            throw new Error("Couldn't create session");
          } catch (error) {
            if (error instanceof AuthError) {
              return { success: false, errorMessage: error.message };
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

export const useAuth = () => {
  const authContext = useContext(AuthContext);

  if (!authContext) {
    throw new Error('useAuth must be used within an AuthContextProvider');
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
