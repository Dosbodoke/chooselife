import { useNetInfo } from '@react-native-community/netinfo';
import { WifiOffIcon } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import Animated, { FadeInUp, FadeOutUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '~/components/ui/icon';
import { Text } from '~/components/ui/text';

export const SafeAreaOfflineView: React.FC<{
  children: React.ReactNode;
  className?: string;
}> = ({ children, className }) => {
  const { t } = useTranslation();
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
          <Icon as={WifiOffIcon} className="size-5 text-red-500" />
          <Text className="text-red-500 flex-shrink">
            {t('components.offlineBannerMessage')}
          </Text>
        </View>
        {children}
      </Animated.View>
    );
  }

  return (
    <View style={{ paddingTop: top }} className={className}>
      {children}
    </View>
  );
};

export const OfflineBanner: React.FC = () => {
  const { t } = useTranslation();
  const { top } = useSafeAreaInsets();
  const { isConnected } = useNetInfo();

  if (isConnected) return null;

  return (
    <Animated.View
      entering={FadeInUp}
      exiting={FadeOutUp}
      className="w-full py-2 bg-red-100 flex-row items-center justify-center gap-2"
      style={{ paddingTop: top }}
    >
      <Icon as={WifiOffIcon} className="size-5 text-red-500" />
      <Text className="text-red-500 flex-shrink">
        {t('components.offlineBannerMessage')}
      </Text>
    </Animated.View>
  );
};
