import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { Provider } from 'react-redux';
import { TRPCProvider } from "./utils/trpc"
import 'react-native-gesture-handler';

import { RootStackParamList } from './navigation/types';
import { setupStore } from './redux/store';
import {
  HomeScreen,
  SearchScreen,
  MapTypeScreen,
  DetailScreen,
  LocationPickerScreen,
  HighlineFormScreen,
} from './screens';

const Stack = createStackNavigator<RootStackParamList>();

const store = setupStore();

export default function App() {
  return (
    <TRPCProvider>
      <Provider store={store}>
        <NavigationContainer>
          <Stack.Navigator initialRouteName="Home" screenOptions={{ headerShown: false }}>
            <Stack.Screen name="Home" component={HomeScreen} />
            <Stack.Screen
              name="Search"
              component={SearchScreen}
              options={{ presentation: 'modal' }}
            />
            <Stack.Screen
              name="MapType"
              component={MapTypeScreen}
              options={{ presentation: 'transparentModal' }}
            />
            <Stack.Screen
              name="DetailScreen"
              component={DetailScreen}
              options={{ presentation: 'card' }}
            />
            <Stack.Screen name="LocationPicker" component={LocationPickerScreen} />
            <Stack.Screen name="HighlineFormScreen" component={HighlineFormScreen} />
          </Stack.Navigator>
        </NavigationContainer>
      </Provider>
    </TRPCProvider>
  );
}
