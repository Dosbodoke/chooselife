import { Canvas } from '@shopify/react-native-skia';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

export const ScrollableCanvas = ({
  width,
  height,
  containerWidth,
  containerHeight,
  scrollHandler,
  onTapEnd,
  children,
}: {
  width: number;
  height: number;
  containerWidth: number;
  containerHeight: number;
  scrollHandler: ReturnType<typeof useAnimatedScrollHandler>;
  onTapEnd: () => void;
  children: React.ReactNode;
}) => {
  const scale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedScale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  const tapGesture = Gesture.Tap()
    .runOnJS(true)
    .onEnd(() => {
      onTapEnd();
    });

  const pinchGesture = Gesture.Pinch()
    .onStart(() => {
      savedScale.value = scale.value;
    })
    .onUpdate((event) => {
      const scaledWidth = containerWidth * savedScale.value * event.scale;
      const scaledHeight = containerHeight * savedScale.value * event.scale;

      // Calculate the minimum scale that keeps the canvas at least the size of the container
      const minScaleWidth = containerWidth / scaledWidth;
      const minScaleHeight = containerHeight / scaledHeight;
      const minScale = Math.max(minScaleWidth, minScaleHeight, 1); // 1 ensures we don't shrink below the container size

      // Calculate the new scale, clamped to [minScale, maxScale]
      const newScale = Math.max(
        minScale,
        Math.min(savedScale.value * event.scale, 3),
      );

      scale.value = newScale;
    });

  const doubleTapGesture = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      scale.value = withTiming(1, { duration: 200 });
      translateX.value = withTiming(0, { duration: 200 });
      translateY.value = withTiming(0, { duration: 200 });
    });

  const composedGesture = Gesture.Simultaneous(
    tapGesture,
    pinchGesture,
    doubleTapGesture,
  );

  return (
    <GestureDetector gesture={composedGesture}>
      <Animated.View style={animatedStyle}>
        <Animated.ScrollView
          horizontal
          showsHorizontalScrollIndicator
          scrollEventThrottle={16}
          onScroll={scrollHandler}
        >
          <Canvas style={{ width, height }}>{children}</Canvas>
        </Animated.ScrollView>
      </Animated.View>
    </GestureDetector>
  );
};
