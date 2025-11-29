import { View } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  type SharedValue,
} from 'react-native-reanimated';

const AnimatedView = Animated.createAnimatedComponent(View);

export type PaginationIndicatorProps = {
  index: number;
  scrollY: SharedValue<number>;
  itemSize: number;
};

export function PaginationIndicator({
  index,
  scrollY,
  itemSize,
}: PaginationIndicatorProps) {
  const rContainerStyle = useAnimatedStyle(() => {
    const progress = scrollY.value / itemSize;

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
      backgroundColor: 'rgba(0,0,0,0.7)',
    };
  }, [index, itemSize]);

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
