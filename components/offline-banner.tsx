import { useNetInfo } from '@react-native-community/netinfo';
import { View } from 'react-native';
import Animated, { FadeInUp, FadeOutUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LucideIcon } from '~/lib/icons/lucide-icon';

import { Text } from './ui/text';

export const SafeAreaOfflineView: React.FC<{
  children: React.ReactNode;
  className?: string;
}> = ({ children, className }) => {
  const { top } = useSafeAreaInsets();
  const { isConnected } = useNetInfo();

  if (isConnected === false) {
    return (
      <Animated.View
        entering={FadeInUp}
        exiting={FadeOutUp}
        style={{ paddingTop: top }}
        className={className}
      >
        <View className="w-full py-2 bg-red-100 flex-row items-center justify-center gap-2">
          <LucideIcon name="WifiOff" className="size-5 text-red-500" />
          <Text className="text-red-500 flex-shrink">Você está offline</Text>
        </View>
        {children}
      </Animated.View>
    );
  }

  return <View style={{ paddingTop: top }}>{children}</View>;
};

export const OfflineBanner: React.FC = () => {
  const { top } = useSafeAreaInsets();
  const { isConnected } = useNetInfo();
  if (isConnected === false) {
    return (
      <Animated.View
        entering={FadeInUp}
        exiting={FadeOutUp}
        className="w-full py-2 bg-red-100 flex-row items-center justify-center gap-2"
        style={{ paddingTop: top }}
      >
        <LucideIcon name="WifiOff" className="size-5 text-red-500" />
        <Text className="text-red-500 flex-shrink">Você está offline</Text>
      </Animated.View>
    );
  }

  return null;
};
