import '~/global.css';

import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { DefaultTheme, Theme, ThemeProvider } from '@react-navigation/native';
import { PortalHost } from '@rn-primitives/portal';
import Mapbox from '@rnmapbox/maps';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';

import { AuthProvider } from '~/context/auth';
import { I18nProvider } from '~/context/i18n';
import { NotificationProvider } from '~/context/notifications';
import { ReactQueryProvider } from '~/context/react-query';
import { useDeepLinkHandler } from '~/hooks/use-deep-link-handler';
import { setAndroidNavigationBar } from '~/utils/android-navigation-bar';
import { NAV_THEME } from '~/utils/constants';

import { OfflineBanner } from '~/components/offline-banner';

Mapbox.setAccessToken(process.env.EXPO_PUBLIC_MAPBOX_PUBLIC_KEY!);

// https://docs.expo.dev/router/advanced/router-settings/
export const unstable_settings = {
  initialRouteName: 'index',
};

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
  useDeepLinkHandler();

  React.useEffect(() => {
    setAndroidNavigationBar('light');
  }, []);

  return (
    <ReactQueryProvider>
      <I18nProvider>
        <AuthProvider>
          <NotificationProvider>
            <ThemeProvider value={LIGHT_THEME}>
              <GestureHandlerRootView>
                <KeyboardProvider>
                  <StatusBar style="dark" />
                  <BottomSheetModalProvider>
                    <Stack
                      screenOptions={{
                        headerBackButtonDisplayMode: 'minimal',
                      }}
                    >
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
                        options={{ headerShown: false }}
                      />
                      <Stack.Screen
                        name="register-highline"
                        options={{ header: () => <OfflineBanner /> }}
                      />
                    </Stack>
                    <PortalHost />
                  </BottomSheetModalProvider>
                </KeyboardProvider>
              </GestureHandlerRootView>
            </ThemeProvider>
          </NotificationProvider>
        </AuthProvider>
      </I18nProvider>
    </ReactQueryProvider>
  );
}
