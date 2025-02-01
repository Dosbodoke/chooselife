import { ActivityIndicator, View } from 'react-native';
import Animated, {
  FadeInDown,
  FadeInLeft,
  FadeOutLeft,
  FadeOutUp,
  interpolateColor,
  LinearTransition,
  SharedValue,
  useAnimatedStyle,
  useDerivedValue,
  withSpring,
} from 'react-native-reanimated';

import { cn } from '~/lib/utils';

import { Button, buttonTextVariants } from '~/components/ui/button';
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
const AnimatedText = Animated.createAnimatedComponent(Text);

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

function OnboardPaginator({
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

function OnboardNavigator({
  selectedIndex,
  total,
  onIndexChange,
  onFinish,
  goBack,
  isLoading,
  finishText = 'Finalizar',
}: {
  selectedIndex: number;
  total: number;
  onIndexChange: (index: number) => void;
  onFinish: () => void;
  // Show back button even if on the first step, intended to navigate out from modals
  goBack?: () => void;
  isLoading?: boolean;
  // Text to be shown on the button when the last step is reached
  finishText?: string;
}) {
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
      {selectedIndex > 0 || goBack ? (
        <AnimatedButton
          variant="outline"
          onPress={handleBack}
          disabled={isLoading}
          entering={_entering}
          exiting={_exiting}
          layout={_layoutTransition}
        >
          <Text>Voltar</Text>
        </AnimatedButton>
      ) : null}
      <AnimatedButton
        className="flex-1"
        variant="default"
        onPress={handleForward}
        disabled={isLoading}
        entering={_entering}
        exiting={_exiting}
        layout={_layoutTransition}
      >
        {isLoading ? (
          <ActivityIndicator
            className={cn(buttonTextVariants({ variant: 'default' }))}
          />
        ) : selectedIndex === total - 1 ? (
          <AnimatedText
            key="finish"
            className={cn(buttonTextVariants({ variant: 'default' }))}
            entering={FadeInDown.springify().damping(80).stiffness(200)}
            exiting={FadeOutUp.springify().damping(80).stiffness(200)}
          >
            {finishText}
          </AnimatedText>
        ) : (
          <AnimatedText
            key="continue"
            className={cn(buttonTextVariants({ variant: 'default' }))}
            layout={_layoutTransition}
            entering={FadeInDown.springify().damping(80).stiffness(200)}
            exiting={FadeOutUp.springify().damping(80).stiffness(200)}
          >
            Continuar
          </AnimatedText>
        )}
      </AnimatedButton>
    </View>
  );
}

export { OnboardNavigator, OnboardPaginator };
