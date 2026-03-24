import { withUniwind } from 'uniwind';
import { SafeAreaView as RNSafeAreaView } from 'react-native-safe-area-context';
import SquircleView from 'react-native-fast-squircle';

export const SafeAreaView = withUniwind(RNSafeAreaView);
export const StyledSquircle = withUniwind(SquircleView);
