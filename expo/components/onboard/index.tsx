import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { ChevronLeft } from 'lucide-react-native';
import Animated, {
  FadeInLeft,
  FadeOutLeft,
  interpolateColor,
  LinearTransition,
  SharedValue,
  useAnimatedStyle,
  useDerivedValue,
  withSpring,
} from 'react-native-reanimated';

import { Button } from '~/components/ui/button';
import { PrimaryButton } from '~/components/ui/primary-button';
import { Text } from '~/components/ui/text';

const _layoutTransition = LinearTransition.springify()
  .damping(80)
  .stiffness(200);
const _entering = FadeInLeft.springify().damping(80).stiffness(200);
const _exiting = FadeOutLeft.springify().damping(80).stiffness(200);
const _dotContainer = 24;
const _dotSize = _dotContainer / 3;
const _activeDot = '#fff';
const _inactiveDot = '#aaa';

const AnimatedButton = Animated.createAnimatedComponent(Button);

function Dot({
  index,
  animation,
}: {
  index: number;
  animation: SharedValue<number>;
}) {
  const stylez = useAnimatedStyle(() => {
    return {
      backgroundColor: interpolateColor(
        animation.value,
        [index - 1, index, index + 1],
        [_inactiveDot, _activeDot, _activeDot],
      ),
    };
  });

  return (
    <Animated.View
      layout={_layoutTransition}
      style={{
        width: _dotContainer,
        height: _dotContainer,
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      <Animated.View
        style={[
          stylez,
          { width: _dotSize, height: _dotSize, borderRadius: _dotSize },
        ]}
      />
    </Animated.View>
  );
}

function PaginationIndicator({
  animation,
}: {
  animation: SharedValue<number>;
}) {
  const stylez = useAnimatedStyle(() => {
    return {
      width: _dotContainer + _dotContainer * animation.value,
    };
  });

  return (
    <Animated.View
      layout={_layoutTransition}
      style={[
        {
          backgroundColor: '#29BE56',
          height: _dotContainer,
          width: _dotContainer,
          borderRadius: _dotContainer,
          position: 'absolute',
          left: 0,
          top: 0,
        },
        stylez,
      ]}
    />
  );
}

export function OnboardPaginator({
  selectedIndex,
  total,
}: {
  selectedIndex: number;
  total: number;
}) {
  const animation = useDerivedValue(() => {
    return withSpring(selectedIndex, { damping: 80, stiffness: 200 });
  });

  return (
    <View className="items-center justify-center">
      <View className="flex-row">
        <PaginationIndicator animation={animation} />
        {[...Array(total).keys()].map((i) => (
          <Dot key={`dot-${i}`} index={i} animation={animation} />
        ))}
      </View>
    </View>
  );
}

export function OnboardHeader({
  selectedIndex,
  total,
  onBack,
}: {
  selectedIndex: number;
  total: number;
  onBack?: () => void;
}) {
  return (
    <View className="flex-row items-center justify-between">
      {onBack ? (
        <Button
          variant="ghost"
          size="icon"
          onPress={onBack}
          className="rounded-full"
        >
          <ChevronLeft className="text-foreground" size={24} />
        </Button>
      ) : (
        <View className="w-10 h-10" />
      )}
      <OnboardPaginator total={total} selectedIndex={selectedIndex} />
      <View className="w-10 h-10" />
    </View>
  );
}

export function OnboardNavigator({
  selectedIndex,
  total,
  onIndexChange,
  onFinish,
  goBack,
  isLoading,
  finishLabel,
  showBack = true,
}: {
  selectedIndex: number;
  total: number;
  onIndexChange: (index: number) => void;
  onFinish: () => void;
  // Show back button even if on the first step, intended to navigate out from modals
  goBack?: () => void;
  isLoading?: boolean;
  // Text to be shown on the button when the last step is reached
  finishLabel?: string;
  showBack?: boolean;
}) {
  const { t } = useTranslation();
  const handleBack = () => {
    if (selectedIndex === 0 && goBack) {
      goBack();
      return;
    }

    if (selectedIndex > 0) {
      onIndexChange(selectedIndex - 1);
    }
  };

  const handleForward = () => {
    if (selectedIndex >= total - 1) {
      onFinish();
      return;
    }
    onIndexChange(selectedIndex + 1);
  };

  return (
    <View className="flex-row gap-2">
      {showBack && (selectedIndex > 0 || goBack) ? (
        <AnimatedButton
          variant="outline"
          className="h-14 rounded-full px-6"
          onPress={handleBack}
          disabled={isLoading}
          entering={_entering}
          exiting={_exiting}
          layout={_layoutTransition}
        >
          <Text>{t('components.onboard.goBack')}</Text>
        </AnimatedButton>
      ) : null}
      <Animated.View className="flex-1" layout={_layoutTransition}>
        <PrimaryButton
          onPress={handleForward}
          loading={isLoading}
          label={
            selectedIndex === total - 1
              ? (finishLabel ?? t('components.onboard.finish'))
              : t('components.onboard.continue')
          }
        />
      </Animated.View>
    </View>
  );
}

