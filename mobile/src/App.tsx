import 'react-native-gesture-handler';
import { NavigationContainer } from '@react-navigation/native';
import { Provider as ReduxProvider } from 'react-redux';
import { ClerkProvider } from '@clerk/clerk-expo';
import Constants from 'expo-constants';

import { TRPCProvider } from './utils/trpc';
import { setupStore } from './redux/store';

import Routes from './navigation';

const store = setupStore();

const publishableKey = Constants?.manifest?.extra?.publishableKey;

export default function App() {
  return (
    <TRPCProvider>
      <ReduxProvider store={store}>
        <NavigationContainer>
          <ClerkProvider publishableKey={publishableKey}>
            <Routes />
          </ClerkProvider>
        </NavigationContainer>
      </ReduxProvider>
    </TRPCProvider>
  );
}
