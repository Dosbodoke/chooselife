import { Image as ExpoImage, ImageSource } from 'expo-image';
import { ArrowRightIcon } from 'lucide-react-native';
import React, { useEffect, useRef, useState } from 'react';
import {
  Dimensions,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  Text,
  View,
} from 'react-native';
import Animated, {
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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
  content?: React.ReactNode;
  onPress?: () => void;
}

interface WidgetProps {
  items: WidgetItem[];
}

// Number of copies to repeat for infinite scroll (odd number recommended)
const REPEAT_COUNT = 5;

export function Widget({ items }: WidgetProps) {
  const { top } = useSafeAreaInsets();
  const scrollViewRef = useRef<Animated.ScrollView>(null);
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

  useEffect(() => {
    // Initialize scroll position to the middle set without animation
    const timer = setTimeout(() => {
      scrollViewRef.current?.scrollTo({
        x: middleStartIndex * CARD_WIDTH,
        animated: false,
      });
    }, 50);
    return () => clearTimeout(timer);
  }, [middleStartIndex]);

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
      scrollViewRef.current?.scrollTo({ x: newOffset, animated: false });
    } else if (rawIndex >= resetThresholdHigh) {
      // Jump backward to the middle set - (totalItems - resetThresholdHigh)
      const newOffset =
        (middleStartIndex - (totalItems - resetThresholdHigh)) * CARD_WIDTH;
      scrollViewRef.current?.scrollTo({ x: newOffset, animated: false });
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
      scrollViewRef.current?.scrollTo({
        x: closestIndex * CARD_WIDTH,
        animated: true,
      });
    }
  };

  const renderItem = (item: WidgetItem, index: number) => {
    // Parallax shift for background image (kept for visual effect)
    const backgroundAnimatedStyle = useAnimatedStyle(() => {
      const inputRange = [
        (index - 1) * CARD_WIDTH,
        index * CARD_WIDTH,
        (index + 1) * CARD_WIDTH,
      ];

      return {
        transform: [
          {
            translateX: interpolate(
              scrollX.value,
              inputRange,
              [-24, 0, 24],
              'clamp',
            ),
          },
        ],
      };
    });

    return (
      <Animated.View
        key={`${item.id}-${index}`}
        className="justify-center items-center"
        style={{
          width: CARD_WIDTH,
          height: heroHeight,
        }}
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
                style={{
                  flex: 1,
                  width: '100%',
                  height: '100%',
                }}
                contentFit="cover"
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
                paddingTop: top + 16,
                paddingBottom: 24,
              }}
            >
              {item.content || (
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
                      {item.subtitle && (
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
                      )}
                    </View>

                    {item.onPress ? (
                      <View className="bg-white/15 rounded-full p-3 ml-3">
                        <Icon
                          as={ArrowRightIcon}
                          size={20}
                          className="text-white"
                        />
                      </View>
                    ) : null}
                  </View>
                </View>
              )}
            </View>

            <View className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/10 to-transparent pointer-events-none" />
          </Pressable>
        </Animated.View>
      </Animated.View>
    );
  };

  const renderDots = () => (
    <View className="flex-row items-center justify-center gap-1">
      {items.map((_, idx) => {
        const animatedDotStyle = useAnimatedStyle(() => {
          // Get current real index from scroll position
          const currentScrollIndex = scrollX.value / CARD_WIDTH;
          const currentRealIndex =
            ((Math.round(currentScrollIndex) % originalLength) +
              originalLength) %
            originalLength;

          const distance = Math.abs(idx - currentRealIndex);
          const adjustedDistance = Math.min(
            distance,
            originalLength - distance,
          );

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
          <Pressable
            key={idx}
            onPress={() => scrollToIndex(idx)}
            className="p-1.5"
          >
            <Animated.View
              className="w-2 h-2 rounded-full"
              style={animatedDotStyle}
            />
          </Pressable>
        );
      })}
    </View>
  );

  return (
    <View style={{ height: heroHeight }} className="bg-transparent">
      <View className="flex-1 bg-transparent">
        <View className="flex-1 bg-transparent relative">
          <Animated.ScrollView
            ref={scrollViewRef}
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
          >
            {infiniteItems.map((item, index) => renderItem(item, index))}
          </Animated.ScrollView>

          <View className="absolute inset-x-0 bottom-6 items-center">
            <View className="bg-black/25 rounded-full px-3 py-2">
              {renderDots()}
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}
