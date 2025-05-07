import { AuthError, type Session } from '@supabase/supabase-js';
import * as AppleAuthentication from 'expo-apple-authentication';
import { makeRedirectUri } from 'expo-auth-session';
import * as QueryParams from 'expo-auth-session/build/QueryParams';
import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import AsyncStorage from 'expo-sqlite/kv-store';
import * as WebBrowser from 'expo-web-browser';
import React, {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';

import { useProfile, type Profile } from '~/hooks/use-profile';
import { supabase } from '~/lib/supabase';

import { useI18n } from './i18n';

type AuthMethodResponse = Promise<
  { success: true } | { success: false; errorMessage?: string }
>;

export type OAuthMethod = 'apple' | 'google';
export type LoginMethod = OAuthMethod | 'email';

interface AuthContextValue {
  login: ({
    email,
    password,
    redirectTo,
  }: {
    email: string;
    password: string;
    redirectTo: string | undefined;
  }) => AuthMethodResponse;
  signUp: ({
    email,
    password,
    confirmPassword,
    redirectTo,
  }: {
    email: string;
    password: string;
    confirmPassword: string;
    redirectTo: string | undefined;
  }) => AuthMethodResponse;
  logout: () => AuthMethodResponse;
  performOAuth: ({
    method,
    redirectTo,
  }: {
    method: OAuthMethod;
    redirectTo: string | undefined;
  }) => AuthMethodResponse;
  profile: Profile | null;
  session: Session | null;
  isLoginPending: boolean;
  sessionLoading: boolean;
  lastLoginMethod: LoginMethod | null;
}

// Create the AuthContext
const AuthContext = React.createContext<AuthContextValue | undefined>(
  undefined,
);

export function AuthProvider(props: React.PropsWithChildren) {
  const { t } = useTranslation();
  const { locale } = useI18n();
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [lastLoginMethod, setLastLoginMethod] = useState<LoginMethod | null>(
    null,
  );
  const [pendingRedirect, setPendingRedirect] = useState<
    'back' | string | null
  >(null);
  const {
    query: { data: profile },
    invalidateProfile,
  } = useProfile(session?.user.id || null);

  const saveLoginMethod = useCallback(async (method: LoginMethod) => {
    try {
      await AsyncStorage.setItem('lastLoginMethod', method);
      setLastLoginMethod(method);
    } catch (error) {
      console.error('Failed to save the login method:', error);
    }
  }, []);

  const login = useCallback(
    async ({
      email,
      password,
      redirectTo,
    }: {
      email: string;
      password: string;
      redirectTo: string | undefined;
    }): AuthMethodResponse => {
      // Validate email
      if (z.string().email().safeParse(email).success === false) {
        return {
          success: false,
          errorMessage: t('app.(modals).login.email.invalidEmail'),
        };
      }

      try {
        setPendingRedirect(redirectTo || 'back');
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) throw error;
        await saveLoginMethod('email');

        return {
          success: true,
        };
      } catch (error) {
        setPendingRedirect(null);
        if ((error as AuthError).code === 'invalid_credentials') {
          return {
            success: false,
            errorMessage: t('context.auth.invalidCredentials'),
          };
        }
        return {
          success: false,
          errorMessage: t('context.auth.loginError'),
        };
      }
    },
    [t, saveLoginMethod],
  );

  const logout = useCallback(async (): AuthMethodResponse => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      invalidateProfile();
      return { success: true };
    } catch (error) {
      if (error instanceof AuthError) {
        return { success: false, errorMessage: error.message };
      }
      return { success: false };
    }
  }, []);

  const signUp = useCallback(
    async ({
      email,
      password,
      confirmPassword,
      redirectTo,
    }: {
      email: string;
      password: string;
      confirmPassword: string;
      redirectTo: string | undefined;
    }): AuthMethodResponse => {
      // Validate email
      if (z.string().email().safeParse(email).success === false) {
        return {
          success: false,
          errorMessage: t('app.(modals).login.email.invalidEmail'),
        };
      }

      if (!password) {
        return {
          success: false,
          errorMessage: t('app.(modals).login.email.passwordRequired'),
        };
      }

      // Validate if password match
      if (password !== confirmPassword) {
        return {
          success: false,
          errorMessage: t('app.(modals).login.email.passwordsMismatch'),
        };
      }

      try {
        setPendingRedirect(redirectTo || 'back');
        const { error } = await supabase.auth.signUp({
          email,
          password,
        });

        if (error) throw error;

        await saveLoginMethod('email');

        return {
          success: true,
        };
      } catch (error) {
        setPendingRedirect(null);
        if (error instanceof AuthError) {
          if (error.code === 'user_already_exists') {
            return {
              success: false,
              errorMessage: t('app.(modals).login.email.emailExists'),
            };
          }
          return { success: false, errorMessage: error.message };
        }
        return {
          success: false,
          errorMessage: t('app.(modals).login.email.signupFailed'),
        };
      }
    },
    [t, saveLoginMethod],
  );

  const handleAppleLogin = async (redirectTo: string | undefined) => {
    try {
      setPendingRedirect(redirectTo || 'back');

      // Request Apple authentication
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      // Sign in via Supabase Auth.
      if (credential.identityToken) {
        const { error } = await supabase.auth.signInWithIdToken({
          provider: 'apple',
          token: credential.identityToken,
        });

        if (error) throw error;

        await saveLoginMethod('apple');
        return { success: true };
      } else {
        throw new Error('No identityToken.');
      }
    } catch (error) {
      setPendingRedirect(null);

      // Type guard to check if error is an object with a code property
      if (error && typeof error === 'object' && 'code' in error) {
        // User canceled the login flow
        if (error.code === 'ERR_APPLE_AUTHENTICATION_CANCELED') {
          return { success: false };
        }
      }

      if (error instanceof AuthError) {
        return { success: false, errorMessage: error.message };
      }

      return {
        success: false,
        errorMessage: t('context.auth.appleLoginFailed'),
      };
    }
  };

  const handleGoogleLogin = async ({
    redirectTo,
  }: {
    redirectTo: string | undefined;
  }) => {
    try {
      setPendingRedirect(redirectTo || 'back');
      const baseRedirectTo = makeRedirectUri({
        path: 'login',
        queryParams: { redirect_to: redirectTo },
      });

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: baseRedirectTo,
          skipBrowserRedirect: true,
        },
      });

      if (error) throw error;

      const res = await WebBrowser.openAuthSessionAsync(
        data?.url ?? '',
        baseRedirectTo,
      );

      if (res.type === 'success') {
        const { url } = res;
        await createSessionFromUrl(url);
        await saveLoginMethod('google');

        return {
          success: true,
        };
      }

      throw new Error(t('context.auth.sessionCreationFailed'));
    } catch (error) {
      setPendingRedirect(null);
      if (error instanceof AuthError) {
        return { success: false, errorMessage: error.message };
      }
      return { success: false };
    }
  };

  const performOAuth = useCallback(
    async ({
      method,
      redirectTo,
    }: {
      method: OAuthMethod;
      redirectTo: string | undefined;
    }): AuthMethodResponse => {
      if (method === 'apple') {
        return handleAppleLogin(redirectTo);
      } else if (method === 'google') {
        return handleGoogleLogin({ redirectTo });
      }

      return { success: false };
    },
    [t, saveLoginMethod],
  );

  // Effect to sync locale preference to DB when profile and locale are ready
  useEffect(
    function syncLocalePreference() {
      if (profile?.id && locale) {
        if (profile.language !== locale) {
          supabase
            .from('profiles')
            .update({ language: locale })
            .eq('id', profile.id)
            .then(({ error }) => {
              if (error) {
                console.error(
                  'Failed to update profile language in DB:',
                  error,
                );
              } else {
                console.log('Profile language updated successfully in DB.');
                // Optionally, you might want to refresh the profile data here
                // if your useProfile hook doesn't automatically reflect this update
              }
            });
        }
      }
    },
    [profile?.id, profile?.language, locale],
  );

  useEffect(function setupSession() {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSessionLoading(false);
      setSession(session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    // Cleanup subscription
    return () => {
      subscription.unsubscribe();
    };
  }, []);

  useEffect(function loadLastLoginMethod() {
    const loadLastLoginMethod = async () => {
      try {
        const method = (await AsyncStorage.getItem(
          'lastLoginMethod',
        )) as LoginMethod;
        setLastLoginMethod(method);
      } catch (error) {
        console.error('Failed to load the login method:', error);
      }
    };

    loadLastLoginMethod();
  }, []);

  // Handle linking into app from email app
  const url = Linking.useURL();
  useEffect(() => {
    if (url) {
      createSessionFromUrl(url);
    }
  }, [url]);

  useEffect(
    function redirectAfterProfileLoad() {
      if (!profile) return;

      // If username is not settled, redirect to onboarding
      if (!profile?.username) {
        router.replace('/setProfile');
        return;
      }

      try {
        if (pendingRedirect && pendingRedirect !== 'back') {
          // @ts-expect-error redirect_to search parameter
          router.replace(pendingRedirect);
          return;
        }

        if (pendingRedirect && router.canGoBack()) {
          router.back();
          return;
        }

        if (pendingRedirect) {
          router.replace('/(tabs)');
          return;
        }
      } finally {
        // Clean the state
        setPendingRedirect(null);
      }
    },
    [profile, pendingRedirect, router],
  );

  // Memoize context value to prevent unnecessary rerenders
  const contextValue = useMemo(
    () => ({
      profile: profile || null,
      session,
      sessionLoading,
      isLoginPending: pendingRedirect !== null,
      lastLoginMethod,
      login,
      logout,
      signUp,
      performOAuth,
    }),
    [
      profile,
      session,
      sessionLoading,
      pendingRedirect,
      lastLoginMethod,
      login,
      logout,
      signUp,
      performOAuth,
    ],
  );

  return (
    <AuthContext.Provider value={contextValue}>
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
