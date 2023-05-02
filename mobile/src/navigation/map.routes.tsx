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

import { type BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { TabParamList } from './tab.routes';
import useTabDisplay from '@src/hooks/useTabDisplay';

export type MapStackParamList = {
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

const MapStack = createStackNavigator<MapStackParamList>();

const MapRoutes = ({ navigation, route }: BottomTabScreenProps<TabParamList, 'Map'>) => {
  useTabDisplay<'Map', MapStackParamList>({
    navigation,
    route,
    screens: ['Home', 'MapType', 'Details'],
  });

  return (
    <MapStack.Navigator initialRouteName="Home" screenOptions={{ headerShown: false }}>
      <MapStack.Screen name="Home" component={HomeScreen} />
      <MapStack.Screen name="Search" component={SearchScreen} />
      <MapStack.Screen
        name="MapType"
        component={MapTypeScreen}
        options={{ presentation: 'transparentModal' }}
      />
      <MapStack.Screen name="Details" component={DetailScreen} options={{ presentation: 'card' }} />
      <MapStack.Screen name="LocationPicker" component={LocationPickerScreen} />
      <MapStack.Screen name="HighlineFormScreen" component={HighlineFormScreen} />
    </MapStack.Navigator>
  );
};

export default MapRoutes;
