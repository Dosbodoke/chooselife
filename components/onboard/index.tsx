import {
  type PressableProps,
  View,
  Text,
  Pressable,
  ActivityIndicator,
} from "react-native";
import { buttonTextVariants, buttonVariants } from "../ui/button";
import Animated, {
  type AnimatedProps,
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
} from "react-native-reanimated";
import { cn } from "~/lib/utils";

const _layoutTransition = LinearTransition.springify()
  .damping(80)
  .stiffness(200);
const _dotContainer = 24;
const _dotSize = _dotContainer / 3;
const _activeDot = "#fff";
const _inactiveDot = "#aaa";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

function Button({ children, style, ...rest }: AnimatedProps<PressableProps>) {
  return (
    <AnimatedPressable
      entering={FadeInLeft.springify().damping(80).stiffness(200)}
      exiting={FadeOutLeft.springify().damping(80).stiffness(200)}
      layout={_layoutTransition}
      {...rest}
    >
      {children}
    </AnimatedPressable>
  );
}

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
        [_inactiveDot, _activeDot, _activeDot]
      ),
    };
  });

  return (
    <View
      style={{
        width: _dotContainer,
        height: _dotContainer,
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <Animated.View
        style={[
          stylez,
          { width: _dotSize, height: _dotSize, borderRadius: _dotSize },
        ]}
      />
    </View>
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
      style={[
        {
          backgroundColor: "#29BE56",
          height: _dotContainer,
          width: _dotContainer,
          borderRadius: _dotContainer,
          position: "absolute",
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
  isLoading,
}: {
  selectedIndex: number;
  total: number;
  onIndexChange: (index: number) => void;
  onFinish: () => void;
  isLoading?: boolean;
}) {
  return (
    <View className="flex-row gap-2">
      {selectedIndex > 0 && (
        <Button
          className={cn(buttonVariants({ variant: "outline" }))}
          onPress={() => {
            onIndexChange(selectedIndex - 1);
          }}
          disabled={isLoading}
        >
          <Text
            className={cn(
              buttonTextVariants({ variant: "outline" }),
              "font-bold"
            )}
          >
            Voltar
          </Text>
        </Button>
      )}
      <Button
        className={cn(buttonVariants({ variant: "default" }), "flex-1")}
        onPress={() => {
          if (selectedIndex >= total - 1) {
            onFinish();
            return;
          }
          onIndexChange(selectedIndex + 1);
        }}
        disabled={isLoading}
      >
        {isLoading ? (
          <ActivityIndicator
            className={cn(buttonTextVariants({ variant: "default" }))}
          />
        ) : selectedIndex === total - 1 ? (
          <Animated.Text
            key="finish"
            className={cn(buttonTextVariants({ variant: "default" }))}
            entering={FadeInDown.springify().damping(80).stiffness(200)}
            exiting={FadeOutUp.springify().damping(80).stiffness(200)}
          >
            Finalizar
          </Animated.Text>
        ) : (
          <Animated.Text
            key="continue"
            className={cn(buttonTextVariants({ variant: "default" }))}
            layout={_layoutTransition}
            entering={FadeInDown.springify().damping(80).stiffness(200)}
            exiting={FadeOutUp.springify().damping(80).stiffness(200)}
          >
            Continuar
          </Animated.Text>
        )}
      </Button>
    </View>
  );
}

export { OnboardNavigator, OnboardPaginator };
