import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { Provider } from 'react-redux';

import { RootStackParamList } from './src/navigation/types';
import { setupStore } from './src/redux/store';
import { HomeScreen, SearchScreen, MapTypeScreen } from './src/screens';

const Stack = createStackNavigator<RootStackParamList>();

const store = setupStore();

export default function App() {
  return (
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
        </Stack.Navigator>
      </NavigationContainer>
    </Provider>
  );
}
