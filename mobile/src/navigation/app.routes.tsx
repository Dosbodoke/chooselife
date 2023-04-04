import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import {
  HomeScreen,
  SearchScreen,
  MapTypeScreen,
  DetailScreen,
  LocationPickerScreen,
  HighlineFormScreen,
} from '@src/screens';

import { RootStackParamList } from './types';

const RootStack = createStackNavigator<RootStackParamList>();

const RootRoutes: React.FC = () => (
  <RootStack.Navigator initialRouteName="Home" screenOptions={{ headerShown: false }}>
    <RootStack.Screen name="Home" component={HomeScreen} />
    <RootStack.Screen name="Search" component={SearchScreen} options={{ presentation: 'modal' }} />
    <RootStack.Screen
      name="MapType"
      component={MapTypeScreen}
      options={{ presentation: 'transparentModal' }}
    />
    <RootStack.Screen name="Details" component={DetailScreen} options={{ presentation: 'card' }} />
    <RootStack.Screen name="LocationPicker" component={LocationPickerScreen} />
    <RootStack.Screen name="HighlineFormScreen" component={HighlineFormScreen} />
  </RootStack.Navigator>
);

export default RootRoutes;
