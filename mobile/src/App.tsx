import 'react-native-gesture-handler';
import { NavigationContainer } from '@react-navigation/native';
import { Provider as ReduxProvider } from 'react-redux';
import { TRPCProvider } from './utils/trpc';

import { setupStore } from './redux/store';

import Routes from './navigation';

const store = setupStore();

export default function App() {
  return (
    <TRPCProvider>
      <ReduxProvider store={store}>
        <NavigationContainer>
          <Routes />
        </NavigationContainer>
      </ReduxProvider>
    </TRPCProvider>
  );
}
