import '~/global.css';

import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { DefaultTheme, Theme, ThemeProvider } from '@react-navigation/native';
import { PortalHost } from '@rn-primitives/portal';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';

import { AuthProvider } from '~/context/auth';
import { I18nProvider } from '~/context/i18n';
import { ReactQueryProvider } from '~/context/react-query';
import useLinking from '~/hooks/useLinking';
import { setAndroidNavigationBar } from '~/lib/android-navigation-bar';
import { NAV_THEME } from '~/lib/constants';

import { OfflineBanner } from '~/components/offline-banner';

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

  React.useEffect(() => {
    setAndroidNavigationBar('light');
  }, []);

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
                    <Stack.Screen
                      name="profile/[username]"
                      options={{
                        headerShown: false,
                      }}
                    />
                    <Stack.Screen
                      name="setProfile"
                      options={{
                        headerShown: false,
                      }}
                    />
                    <Stack.Screen
                      name="location-picker"
                      options={{ header: () => <OfflineBanner /> }}
                    />
                    <Stack.Screen
                      name="register-highline"
                      options={{ headerShown: false }}
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
