import { Image as ExpoImage } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useDerivedValue,
  type SharedValue,
} from 'react-native-reanimated';

import { cn } from '~/lib/utils';

const AnimatedView = Animated.createAnimatedComponent(View);

export type ShowcaseItemData = {
  image: string;
  title: string;
  description: string;
};

export type ShowcaseItemProps = {
  index: number;
  scrollY: SharedValue<number>;
  item: ShowcaseItemData;
  itemSize: number;
};

export function ShowcaseItem({
  item,
  index,
  scrollY,
  itemSize,
}: ShowcaseItemProps) {
  const animatedIndex = useDerivedValue(() => {
    return scrollY.value / itemSize;
  });

  const rContainerStyle = useAnimatedStyle(() => {
    // For some reason it's stuterring
    // const translateY =
    //   Platform.OS === 'ios'
    //     ? interpolate(
    //         scrollY.value,
    //         [(index - 1) * itemSize, index * itemSize, index * itemSize + 1],
    //         [0, 0, 1],
    //       )
    //     : 0;

    return {
      opacity: interpolate(
        animatedIndex.value,
        [index - 1, index, index + 1],
        [0, 1, 0],
      ),
      transform: [
        // {
        //   translateY,
        // },
        {
          scale: interpolate(
            scrollY.get(),
            [(index - 1) * itemSize, index * itemSize, (index + 1) * itemSize],
            [1.2, 1, 0.1],
            {
              extrapolateRight: Extrapolation.CLAMP,
            },
          ),
        },
      ],
    };
  });

  const rImageStyle = useAnimatedStyle(() => {
    return {
      opacity: interpolate(
        animatedIndex.value,
        [index - 1, index, index + 1],
        [0, 0.3, 0],
      ),
      transform: [
        // {
        //   translateY: interpolate(
        //     scrollY.value,
        //     [(index - 1) * itemSize, index * itemSize, index * itemSize + 1],
        //     [0, 0, 1],
        //   ),
        // },
        {
          scale: interpolate(
            scrollY.value,
            [(index - 1) * itemSize, index * itemSize, (index + 1) * itemSize],
            [5, 1, 1],
            {
              extrapolateRight: Extrapolation.CLAMP,
            },
          ),
        },
      ],
    };
  });

  return (
    <View className="flex-1">
      <AnimatedView style={[StyleSheet.absoluteFill, rImageStyle]}>
        <ExpoImage
          source={{ uri: item.image }}
          style={StyleSheet.absoluteFill}
          blurRadius={100}
        />
      </AnimatedView>
      <AnimatedView
        className="flex-1 items-center justify-center p-8"
        style={[rContainerStyle]}
      >
        <Text className="text-4xl text-foreground font-bold tracking-tighter mb-6">
          {item.title}
        </Text>
        <View
          className={cn(
            'w-[62%] aspect-[1/2] items-center justify-center rounded-3xl p-0 border border-neutral-100 shadow-2xl shadow-black/5',
          )}
        >
          <ExpoImage
            source={{ uri: item.image }}
            style={StyleSheet.absoluteFill}
            transition={200}
          />
        </View>
        <View className="pt-8 gap-5 w-[82%]">
          <Text className="text-center text-foreground text-lg tracking-wider">
            {item.description}
          </Text>
        </View>
      </AnimatedView>
    </View>
  );
}
