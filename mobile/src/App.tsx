import 'react-native-gesture-handler';
import { NavigationContainer } from '@react-navigation/native';
import { Provider as ReduxProvider } from 'react-redux';
import { ClerkProvider } from '@clerk/clerk-expo';
import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';

import { TRPCProvider } from './utils/trpc';
import { setupStore } from './redux/store';

import Routes from './navigation';

const store = setupStore();

if (!Constants?.manifest?.extra?.clerkPublishableKey) {
  throw new Error('Missing Clerk Publishable Key, set it on .env file');
}

const tokenCache = {
  async getToken(key: string) {
    try {
      return SecureStore.getItemAsync(key);
    } catch (err) {
      return null;
    }
  },
  async saveToken(key: string, value: string) {
    try {
      return SecureStore.setItemAsync(key, value);
    } catch (err) {
      return;
    }
  },
};

export default function App() {
  return (
    <ClerkProvider
      publishableKey={Constants?.manifest?.extra?.clerkPublishableKey}
      tokenCache={tokenCache}>
      <ReduxProvider store={store}>
        <TRPCProvider>
          <NavigationContainer>
            <Routes />
          </NavigationContainer>
        </TRPCProvider>
      </ReduxProvider>
    </ClerkProvider>
  );
}
