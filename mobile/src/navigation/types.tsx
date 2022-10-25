import { StackScreenProps } from '@react-navigation/stack';

export type RootStackParamList = {
  Home: undefined;
  Search: undefined;
  MapType: undefined;
};

export type HomeScreenProps = StackScreenProps<RootStackParamList, 'Home'>;

export type SearchScreenProps = StackScreenProps<RootStackParamList, 'Search'>;

export type MapTypeScrenProps = StackScreenProps<RootStackParamList, 'MapType'>;
