import { WifiOffIcon } from '~/lib/icons/hugeicons';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import Animated, { FadeInUp, FadeOutUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useOnlineStatus } from '~/context/react-query';
import { shouldRenderOfflineBanner } from '~/features/festival/offline-policy';

import { Icon } from '~/components/ui/icon';
import { Text } from '~/components/ui/text';

export const SafeAreaOfflineView: React.FC<{
  children: React.ReactNode;
  className?: string;
  edges?: ('top' | 'bottom' | 'left' | 'right')[];
  offlineBannerCoversStatusBar?: boolean;
}> = ({
  children,
  className,
  edges = ['top', 'left', 'right'],
  offlineBannerCoversStatusBar = true,
}) => {
  const { t } = useTranslation();
  const { top, bottom, left, right } = useSafeAreaInsets();
  const isOnline = useOnlineStatus();

  if (shouldRenderOfflineBanner(isOnline)) {
    return (
      <Animated.View
        entering={FadeInUp}
        exiting={FadeOutUp}
        style={{
          ...(edges?.includes('bottom') && { paddingBottom: bottom }),
          ...(edges?.includes('left') && { paddingLeft: left }),
          ...(edges?.includes('right') && { paddingRight: right }),
        }}
        className={className}
      >
        <View
          className="w-full py-2 bg-red-100 flex-row items-center justify-center gap-2"
          style={{
            // Extend the banner under the translucent status bar while offline.
            ...(offlineBannerCoversStatusBar && { paddingTop: top }),
          }}
        >
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
    <View
      style={{
        ...(edges?.includes('top') && { paddingTop: top }),
        ...(edges?.includes('bottom') && { paddingBottom: bottom }),
        ...(edges?.includes('left') && { paddingLeft: left }),
        ...(edges?.includes('right') && { paddingRight: right }),
      }}
      className={className}
    >
      {children}
    </View>
  );
};

export const OfflineBanner: React.FC = () => {
  const { t } = useTranslation();
  const { top } = useSafeAreaInsets();
  const isOnline = useOnlineStatus();

  if (!shouldRenderOfflineBanner(isOnline)) return null;

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
