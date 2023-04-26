import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { Camera, LatLng } from 'react-native-maps';
import { RouterOutput } from '@src/utils/trpc';
import {
  HomeScreen,
  SearchScreen,
  MapTypeScreen,
  DetailScreen,
  LocationPickerScreen,
  HighlineFormScreen,
} from '@src/screens';

export type RootStackParamList = {
  Home: undefined;
  Search: undefined;
  MapType: undefined;
  Details: {
    highline: NonNullable<RouterOutput['highline']['getById']>;
  };
  LocationPicker: {
    camera?: Camera;
  };
  HighlineFormScreen: {
    lenght: string;
    markers: LatLng[];
  };
};

const RootStack = createStackNavigator<RootStackParamList>();

const RootRoutes: React.FC = () => (
  <RootStack.Navigator initialRouteName="Home" screenOptions={{ headerShown: false }}>
    <RootStack.Screen name="Home" component={HomeScreen} />
    <RootStack.Screen name="Search" component={SearchScreen} />
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
