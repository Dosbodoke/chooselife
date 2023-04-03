import { StackScreenProps } from '@react-navigation/stack';
import { Camera, LatLng } from 'react-native-maps';
import { RouterOutput } from '@src/utils/trpc';

export type RootStackParamList = {
  Home: undefined;
  Search: undefined;
  MapType: undefined;
  Details: {
    highline: RouterOutput['highline']['createHighline'];
  };
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

export type DetailScreenProps = StackScreenProps<RootStackParamList, 'Details'>;

export type LocationPickerScreenProps = StackScreenProps<RootStackParamList, 'LocationPicker'>;

export type HighlineFormScreenProps = StackScreenProps<RootStackParamList, 'HighlineFormScreen'>;
