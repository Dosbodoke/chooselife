import { useRouter } from 'expo-router';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  type SharedValue,
} from 'react-native-reanimated';

import { Button } from '~/components/ui/button';
import { Text } from '~/components/ui/text';

export const BecomeMember = () => {
  const { t } = useTranslation();
  const router = useRouter();

  return (
    <View className="absolute bottom-0 left-0 w-full px-6 py-4 bg-white">
      <Button onPress={() => router.push('/organizations/member')}>
        <Text>{t('app.organizations.becomeMember')}</Text>
      </Button>
    </View>
  );
};

const AnimatedView = Animated.createAnimatedComponent(View);

export type PaginationIndicatorProps = {
  index: number;
  scrollY: SharedValue<number>;
  itemSize: number;
  isOnDarkBackground?: boolean;
};

export function PaginationIndicator({
  index,
  scrollY,
  itemSize,
  isOnDarkBackground = false,
}: PaginationIndicatorProps) {
  const rContainerStyle = useAnimatedStyle(() => {
    const progress = scrollY.get() / itemSize;

    return {
      opacity: interpolate(
        progress,
        [index - 2, index - 1, index, index + 1, index + 2],
        [0.2, 0.5, 1, 0.5, 0.2],
        Extrapolation.CLAMP,
      ),
      transform: [
        {
          scaleX: interpolate(
            progress,
            [index - 2, index - 1, index, index + 1, index + 2],
            [1, 1.4, 2, 1.4, 1],
            Extrapolation.CLAMP,
          ),
        },
      ],
      backgroundColor: isOnDarkBackground
        ? 'rgba(255,255,255,1)'
        : 'rgba(0,0,0,0.7)',
    };
  }, [index, itemSize, isOnDarkBackground]);

  return (
    <AnimatedView
      className="w-3 h-[2px] rounded-full"
      style={[
        {
          transformOrigin: ['100%', '50%', 0],
        },
        rContainerStyle,
      ]}
    />
  );
}
