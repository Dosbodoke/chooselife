import '~/global.css';

import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { DefaultTheme, Theme, ThemeProvider } from '@react-navigation/native';
import { PortalHost } from '@rn-primitives/portal';
import translationEn from '~/i18n/locales/en-US/translation.json';
import translationPt from '~/i18n/locales/pt-BR/translation.json';
import * as Localization from 'expo-localization';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import AsyncStorage from 'expo-sqlite/kv-store';
import { StatusBar } from 'expo-status-bar';
import i18next from 'i18next';
import React from 'react';
import { initReactI18next } from 'react-i18next';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';

import { AuthProvider } from '~/context/auth';
import { I18nProvider } from '~/context/i18n';
import { ReactQueryProvider } from '~/context/react-query';
import useLinking from '~/hooks/useLinking';
import { setAndroidNavigationBar } from '~/lib/android-navigation-bar';
import { NAV_THEME } from '~/lib/constants';
import { useColorScheme } from '~/lib/useColorScheme';

import { OfflineBanner } from '~/components/offline-banner';

export const resources = {
  pt: { translation: translationPt },
  en: { translation: translationEn },
} as const;

// Only one theme is needed now.
const LIGHT_THEME: Theme = {
  ...DefaultTheme,
  dark: false,
  colors: NAV_THEME.light,
};

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary,
} from 'expo-router';

// Prevent the splash screen from auto-hiding.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  useLinking();
  const { setColorScheme } = useColorScheme();
  const [languageLoaded, setLanguageLoaded] = React.useState(false);
  const [language, setLanguage] = React.useState<string | undefined>('en');

  React.useEffect(() => {
    if (!language || languageLoaded) return;
    i18next.use(initReactI18next).init({
      lng: language, // savedLanguage || undefined
      resources,
      fallbackLng: 'pt',
      interpolation: {
        escapeValue: false,
      },
      compatibilityJSON: 'v4',
    });
    setLanguageLoaded(true);
  }, [language, languageLoaded]);

  React.useEffect(() => {
    const getSystemLanguageAndSet = async () => {
      const storedLocale = await AsyncStorage.getItem('chooselife_locale');
      const phoneLocale =
        Localization.getLocales()?.[0]?.languageTag ?? 'pt-BR';
      setLanguage(storedLocale ? storedLocale : phoneLocale);
    };

    getSystemLanguageAndSet();
  }, []);

  React.useEffect(() => {
    if (languageLoaded) {
      // Enforce light mode
      setColorScheme('light');
      setAndroidNavigationBar('light');
      SplashScreen.hideAsync();
    }
  }, [language, languageLoaded]);

  if (!languageLoaded) {
    return null;
  }

  return (
    <ReactQueryProvider>
      <I18nProvider>
        <AuthProvider>
          <ThemeProvider value={LIGHT_THEME}>
            <GestureHandlerRootView>
              <KeyboardProvider>
                <StatusBar style="dark" />
                <BottomSheetModalProvider>
                  <Stack>
                    <Stack.Screen
                      name="(tabs)"
                      options={{
                        headerShown: false,
                      }}
                    />
                    <Stack.Screen
                      name="(modals)/login"
                      options={{
                        presentation: 'modal',
                        title: 'Entrar ou criar conta',
                      }}
                    />
                    <Stack.Screen
                      name="(modals)/register-webbing"
                      options={{
                        presentation: 'modal',
                        headerShown: false,
                      }}
                    />
                    <Stack.Screen
                      name="highline/[id]"
                      options={{
                        headerShown: false,
                      }}
                    />
                    <Stack.Screen name="profile/[username]" />
                    <Stack.Screen
                      name="setProfile"
                      options={{
                        headerShown: false,
                      }}
                    />
                    <Stack.Screen
                      name="register-highline"
                      options={{ header: () => <OfflineBanner /> }}
                    />
                  </Stack>
                </BottomSheetModalProvider>
                <PortalHost />
              </KeyboardProvider>
            </GestureHandlerRootView>
          </ThemeProvider>
        </AuthProvider>
      </I18nProvider>
    </ReactQueryProvider>
  );
}
