import { StackScreenProps } from '@react-navigation/stack';
import { Camera, LatLng } from 'react-native-maps';

export type RootStackParamList = {
  Home: undefined;
  Search: undefined;
  MapType: undefined;
  DetailScreen: undefined;
  LocationPicker: {
    camera?: Camera;
  };
  HighlineFormScreen: {
    lenght: string;
    markers: LatLng[];
  };
};

export type HomeScreenProps = StackScreenProps<RootStackParamList, 'Home'>;

export type SearchScreenProps = StackScreenProps<RootStackParamList, 'Search'>;

export type MapTypeScreenProps = StackScreenProps<RootStackParamList, 'MapType'>;

export type DetailScreenScrenProps = StackScreenProps<RootStackParamList, 'DetailScreen'>;

export type LocationPickerScreenProps = StackScreenProps<RootStackParamList, 'LocationPicker'>;

export type HighlineFormScreenProps = StackScreenProps<RootStackParamList, 'HighlineFormScreen'>;
