import { StackScreenProps } from '@react-navigation/stack';

export type RootStackParamList = {
  Home: undefined;
  Search: undefined;
  MapType: undefined;
  DetailScreen: undefined;
};

export type HomeScreenProps = StackScreenProps<RootStackParamList, 'Home'>;

export type SearchScreenProps = StackScreenProps<RootStackParamList, 'Search'>;

export type MapTypeScreenProps = StackScreenProps<RootStackParamList, 'MapType'>;

export type DetailScreenScrenProps = StackScreenProps<RootStackParamList, 'DetailScreen'>;
