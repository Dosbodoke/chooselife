// Import your global CSS file
import '~/global.css';

import NetInfo from '@react-native-community/netinfo';
import { DefaultTheme, Theme, ThemeProvider } from '@react-navigation/native';
import { PortalHost } from '@rn-primitives/portal';
import { onlineManager, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';

import { AuthProvider } from '~/context/auth';
import useLinking from '~/hooks/useLinking';
import { setAndroidNavigationBar } from '~/lib/android-navigation-bar';
import { NAV_THEME } from '~/lib/constants';
import queryClient from '~/lib/react-query';

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

  // Listen for connectivity changes.
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      onlineManager.setOnline(!!state.isConnected);
    });
    return unsubscribe;
  }, []);

  // Set the Android navigation bar theme to light and hide the splash screen.
  useEffect(() => {
    setAndroidNavigationBar('light');
    SplashScreen.hideAsync();
  }, []);

  return (
    <KeyboardProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <ThemeProvider value={LIGHT_THEME}>
            <GestureHandlerRootView>
              <StatusBar style="dark" />
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
                  name="register-highline"
                  options={{
                    headerShown: false,
                  }}
                />
              </Stack>
              <PortalHost />
            </GestureHandlerRootView>
          </ThemeProvider>
        </AuthProvider>
      </QueryClientProvider>
    </KeyboardProvider>
  );
}
