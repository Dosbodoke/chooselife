import { Image as ExpoImage, ImageSource } from 'expo-image';
import { ArrowRightIcon } from '~/lib/icons/hugeicons';
import React, { useRef, useState } from 'react';
import {
  Dimensions,
  FlatList,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  Text,
  View,
  type ListRenderItemInfo,
} from 'react-native';
import Animated, {
  interpolate,
  type SharedValue,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useMountEffect } from '~/hooks/use-mount-effect';

import { Icon } from '~/components/ui/icon';

const { width: screenWidth } = Dimensions.get('window');
const CARD_WIDTH = screenWidth;
export const WIDGET_HERO_BASE_HEIGHT = 320;
const CONTENT_HORIZONTAL_PADDING = 16;

interface WidgetItem {
  id: string;
  title: string;
  subtitle?: string;
  background: string | ImageSource;
  /** How to align the background when cropped with cover. Defaults to center. */
  contentPosition?: 'center' | 'top';
  content?: React.ReactNode;
  onPress?: () => void;
}

interface WidgetProps {
  items: WidgetItem[];
}

type WidgetSlideProps = {
  heroHeight: number;
  index: number;
  item: WidgetItem;
  scrollX: SharedValue<number>;
  topInset: number;
};

function WidgetSlide({
  heroHeight,
  index,
  item,
  scrollX,
  topInset,
}: WidgetSlideProps) {
  const backgroundAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateX: interpolate(
          scrollX.value,
          [
            (index - 1) * CARD_WIDTH,
            index * CARD_WIDTH,
            (index + 1) * CARD_WIDTH,
          ],
          [-24, 0, 24],
          'clamp',
        ),
      },
    ],
  }));

  return (
    <Animated.View
      className="justify-center items-center"
      style={{ width: CARD_WIDTH, height: heroHeight }}
    >
      <Animated.View className="flex-1 w-full">
        <Pressable
          onPress={item.onPress}
          className="flex-1 w-full overflow-hidden bg-black"
        >
          <Animated.View
            className="absolute inset-0"
            style={backgroundAnimatedStyle}
          >
            <ExpoImage
              source={
                typeof item.background === 'string'
                  ? { uri: item.background }
                  : item.background
              }
              style={{ flex: 1, width: '100%', height: '100%' }}
              contentFit="cover"
              contentPosition={item.contentPosition ?? 'center'}
              cachePolicy="disk"
            />
          </Animated.View>

          <View className="absolute inset-0 bg-black/20" />
          <View className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-transparent" />
          <View className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-transparent" />

          <View
            className="absolute inset-x-0 bottom-0 z-10"
            style={{
              paddingHorizontal: CONTENT_HORIZONTAL_PADDING,
              paddingTop: topInset + 16,
              paddingBottom: 24,
            }}
          >
            {item.content || <WidgetSlideContent item={item} />}
          </View>

          <View className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/10 to-transparent pointer-events-none" />
        </Pressable>
      </Animated.View>
    </Animated.View>
  );
}

function WidgetSlideContent({ item }: { item: WidgetItem }) {
  return (
    <View className="bg-black/35 backdrop-blur-md rounded-[28px] p-5 border border-white/15">
      <View className="flex-row items-start justify-between mb-2">
        <View className="flex-1">
          <Text
            className="text-2xl font-black text-white mb-2 leading-tight tracking-tight"
            style={{
              textShadowColor: 'rgba(0, 0, 0, 0.8)',
              textShadowOffset: { width: 0, height: 2 },
              textShadowRadius: 8,
            }}
          >
            {item.title}
          </Text>
          {item.subtitle ? (
            <Text
              className="text-lg font-semibold text-white/85 leading-snug mb-3"
              style={{
                textShadowColor: 'rgba(0, 0, 0, 0.6)',
                textShadowOffset: { width: 0, height: 1 },
                textShadowRadius: 4,
              }}
            >
              {item.subtitle}
            </Text>
          ) : null}
        </View>

        {item.onPress ? (
          <View className="bg-white/15 rounded-full p-3 ml-3">
            <Icon as={ArrowRightIcon} size={20} className="text-white" />
          </View>
        ) : null}
      </View>
    </View>
  );
}

type WidgetDotsProps = {
  itemCount: number;
  onSelect: (index: number) => void;
  scrollX: SharedValue<number>;
};

function WidgetDots({ itemCount, onSelect, scrollX }: WidgetDotsProps) {
  return (
    <View className="flex-row items-center justify-center gap-1">
      {Array.from({ length: itemCount }, (_, index) => (
        <WidgetDot
          key={index}
          index={index}
          itemCount={itemCount}
          onPress={() => onSelect(index)}
          scrollX={scrollX}
        />
      ))}
    </View>
  );
}

function WidgetDot({
  index,
  itemCount,
  onPress,
  scrollX,
}: {
  index: number;
  itemCount: number;
  onPress: () => void;
  scrollX: SharedValue<number>;
}) {
  const animatedStyle = useAnimatedStyle(() => {
    const currentIndex = Math.round(scrollX.value / CARD_WIDTH) % itemCount;
    const normalizedIndex = (currentIndex + itemCount) % itemCount;
    const distance = Math.abs(index - normalizedIndex);
    const adjustedDistance = Math.min(distance, itemCount - distance);

    return {
      transform: [
        {
          scale: interpolate(
            adjustedDistance,
            [0, 1],
            [1.25, 0.85],
            'clamp',
          ),
        },
      ],
      opacity: interpolate(adjustedDistance, [0, 1], [1, 0.55], 'clamp'),
      backgroundColor: '#fff',
    };
  });

  return (
    <Pressable onPress={onPress} className="p-1.5">
      <Animated.View
        className="w-2 h-2 rounded-full"
        style={animatedStyle}
      />
    </Pressable>
  );
}

// Number of copies to repeat for infinite scroll (odd number recommended)
const REPEAT_COUNT = 5;

export function Widget({ items }: WidgetProps) {
  const { top } = useSafeAreaInsets();
  const scrollViewRef = useRef<FlatList<WidgetItem>>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const scrollX = useSharedValue(0);
  const heroHeight = WIDGET_HERO_BASE_HEIGHT + top;

  // Build infinite array (REPEAT_COUNT copies of original items)
  const infiniteItems = Array(REPEAT_COUNT).fill(items).flat();
  const totalItems = infiniteItems.length;
  const originalLength = items.length;
  // Start at the middle set (so we have enough room in both directions)
  const middleStartIndex = Math.floor(REPEAT_COUNT / 2) * originalLength;
  // Reset thresholds: when we are within the first or last original-length chunk, jump back
  const resetThresholdLow = originalLength;
  const resetThresholdHigh = totalItems - originalLength;

  useMountEffect(() => {
    // Initialize scroll position to the middle set without animation
    const timer = setTimeout(() => {
      scrollViewRef.current?.scrollToOffset({
        offset: middleStartIndex * CARD_WIDTH,
        animated: false,
      });
    }, 50);
    return () => clearTimeout(timer);
  });

  const updateCurrentIndex = (offsetX: number) => {
    const rawIndex = Math.round(offsetX / CARD_WIDTH);
    // Convert to real index within original items
    const realIndex =
      ((rawIndex % originalLength) + originalLength) % originalLength;
    setCurrentIndex(realIndex);
  };

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollX.value = event.contentOffset.x;
    },
  });

  const onMomentumScrollEnd = (
    event: NativeSyntheticEvent<NativeScrollEvent>,
  ) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    const rawIndex = Math.round(offsetX / CARD_WIDTH);
    updateCurrentIndex(offsetX);

    // Reset scroll position if we are near the boundaries
    if (rawIndex <= resetThresholdLow) {
      // Jump forward to the middle set + low threshold
      const newOffset = (middleStartIndex + resetThresholdLow) * CARD_WIDTH;
      scrollViewRef.current?.scrollToOffset({
        offset: newOffset,
        animated: false,
      });
    } else if (rawIndex >= resetThresholdHigh) {
      // Jump backward to the middle set - (totalItems - resetThresholdHigh)
      const newOffset =
        (middleStartIndex - (totalItems - resetThresholdHigh)) * CARD_WIDTH;
      scrollViewRef.current?.scrollToOffset({
        offset: newOffset,
        animated: false,
      });
    }
  };

  const scrollToIndex = (targetRealIndex: number) => {
    if (targetRealIndex === currentIndex) return;

    const currentScrollIndex = Math.round(scrollX.value / CARD_WIDTH);
    // Find the closest occurrence of targetRealIndex in the infinite array
    // We search within a reasonable range around currentScrollIndex
    let closestIndex = -1;
    let minDistance = Infinity;
    for (let i = -originalLength; i <= originalLength; i++) {
      const candidate = currentScrollIndex + i;
      if (candidate >= 0 && candidate < totalItems) {
        if (
          ((candidate % originalLength) + originalLength) % originalLength ===
          targetRealIndex
        ) {
          const distance = Math.abs(candidate - currentScrollIndex);
          if (distance < minDistance) {
            minDistance = distance;
            closestIndex = candidate;
          }
        }
      }
    }
    if (closestIndex !== -1) {
      scrollViewRef.current?.scrollToOffset({
        offset: closestIndex * CARD_WIDTH,
        animated: true,
      });
    }
  };

  const renderWidgetItem = ({ item, index }: ListRenderItemInfo<WidgetItem>) =>
    <WidgetSlide
      heroHeight={heroHeight}
      index={index}
      item={item}
      scrollX={scrollX}
      topInset={top}
    />;

  return (
    <View style={{ height: heroHeight }} className="bg-transparent">
      <View className="flex-1 bg-transparent">
        <View className="flex-1 bg-transparent relative">
          <Animated.FlatList
            ref={scrollViewRef}
            data={infiniteItems}
            renderItem={renderWidgetItem}
            keyExtractor={(item, index) => `${item.id}-${index}`}
            horizontal
            showsHorizontalScrollIndicator={false}
            pagingEnabled
            decelerationRate="fast"
            snapToInterval={CARD_WIDTH}
            snapToAlignment="start"
            style={{ backgroundColor: 'transparent' }}
            contentContainerStyle={{ backgroundColor: 'transparent' }}
            onScroll={scrollHandler}
            onMomentumScrollEnd={onMomentumScrollEnd}
            scrollEventThrottle={16}
          />

          <View className="absolute inset-x-0 bottom-6 items-center">
            <View className="bg-black/25 rounded-full px-3 py-2">
              <WidgetDots
                itemCount={items.length}
                onSelect={scrollToIndex}
                scrollX={scrollX}
              />
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}
