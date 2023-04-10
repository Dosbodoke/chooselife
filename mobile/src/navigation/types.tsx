import { StackScreenProps } from '@react-navigation/stack';

import { RootStackParamList } from './app.routes';
import { AuthStackParamList } from './auth.routes';

export type HomeScreenProps = StackScreenProps<RootStackParamList, 'Home'>;

export type SearchScreenProps = StackScreenProps<RootStackParamList, 'Search'>;

export type MapTypeScreenProps = StackScreenProps<RootStackParamList, 'MapType'>;

export type DetailScreenProps = StackScreenProps<RootStackParamList, 'Details'>;

export type LocationPickerScreenProps = StackScreenProps<RootStackParamList, 'LocationPicker'>;

export type HighlineFormScreenProps = StackScreenProps<RootStackParamList, 'HighlineFormScreen'>;

export type LogInScreenProps = StackScreenProps<AuthStackParamList, 'LogIn'>;

export type SignUpScreenProps = StackScreenProps<AuthStackParamList, 'SignUp'>;
