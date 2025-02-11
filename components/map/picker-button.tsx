import React from 'react';
import { useTranslation } from 'react-i18next';
import { TouchableOpacity, View } from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
  LinearTransition,
} from 'react-native-reanimated';

import { LucideIcon } from '~/lib/icons/lucide-icon';

type Stage = 'initial' | 'partial' | 'final';

const AnimatedTouchableOpacity =
  Animated.createAnimatedComponent(TouchableOpacity);

export const PickerControls: React.FC<{
  onPick: () => void;
  onUndo: () => void;
  stage: Stage;
}> = ({ onPick, onUndo, stage }) => {
  const { t } = useTranslation();
  const labels: Record<Stage, string> = {
    initial: t('components.map.picker-buttons.setA'),
    partial: t('components.map.picker-buttons.setB'),
    final: t('components.map.picker-buttons.confirm'),
  };

  return (
    <Animated.View className="absolute bottom-8 left-0 right-0 items-center overflow-hidden">
      <Animated.View
        layout={LinearTransition.springify().damping(80).stiffness(200)}
        className="flex-row bg-primary border-border border-hairline rounded"
      >
        <AnimatedTouchableOpacity
          onPress={onUndo}
          layout={LinearTransition.springify().damping(80).stiffness(200)}
          className="p-3 border-r-hairline border-border"
        >
          <LucideIcon
            name={stage === 'initial' ? 'ChevronLeft' : 'MapPinOff'}
            className="size-6 text-red-500"
          />
        </AnimatedTouchableOpacity>
        <View className="px-3 justify-center overflow-hidden">
          <Animated.Text
            key={stage}
            entering={FadeIn.springify().damping(80).stiffness(200)}
            exiting={FadeOut.springify().damping(80).stiffness(200)}
            className="text-white text-lg text-center"
          >
            {labels[stage]}
          </Animated.Text>
        </View>
        <AnimatedTouchableOpacity
          onPress={onPick}
          layout={LinearTransition.springify().damping(80).stiffness(200)}
          className="p-3 border-l-hairline border-border"
        >
          <LucideIcon
            name={stage === 'final' ? 'Check' : 'MapPinned'}
            className="size-6 text-green-500"
          />
        </AnimatedTouchableOpacity>
      </Animated.View>
    </Animated.View>
  );
};
