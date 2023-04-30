import { StackScreenProps } from '@react-navigation/stack';

import { MapStackParamList } from './map.routes';
import { AuthStackParamList } from './auth.routes';

export type HomeScreenProps = StackScreenProps<MapStackParamList, 'Home'>;

export type SearchScreenProps = StackScreenProps<MapStackParamList, 'Search'>;

export type MapTypeScreenProps = StackScreenProps<MapStackParamList, 'MapType'>;

export type DetailScreenProps = StackScreenProps<MapStackParamList, 'Details'>;

export type LocationPickerScreenProps = StackScreenProps<MapStackParamList, 'LocationPicker'>;

export type HighlineFormScreenProps = StackScreenProps<MapStackParamList, 'HighlineFormScreen'>;

export type LogInScreenProps = StackScreenProps<AuthStackParamList, 'LogIn'>;

export type SignUpScreenProps = StackScreenProps<AuthStackParamList, 'SignUp'>;
