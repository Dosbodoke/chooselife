import React, { useEffect, useRef, useState } from 'react';
import {
  Dimensions,
  ImageBackground,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, {
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';

const { width: screenWidth } = Dimensions.get('window');
const CARD_WIDTH = screenWidth - 16; // Adjust for padding and dots
const CARD_SPACING = 16; // Add spacing between cards

interface AppleWidgetItem {
  id: string;
  title: string;
  subtitle?: string;
  background: string;
  content?: React.ReactNode;
}

interface AppleWidgetProps {
  items: AppleWidgetItem[];
}

export default function AppleWidget({ items }: AppleWidgetProps) {
  const scrollViewRef = useRef<Animated.ScrollView>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const scrollX = useSharedValue(0);

  // Triple items for infinite scroll
  const infiniteItems = [...items, ...items, ...items];
  const middleIndex = items.length;

  useEffect(() => {
    // Start in the middle for infinite effect
    const timer = setTimeout(() => {
      scrollViewRef.current?.scrollTo({
        x: middleIndex * (CARD_WIDTH + CARD_SPACING),
        animated: false,
      });
    }, 100);
    return () => clearTimeout(timer);
  }, [middleIndex]);

  const updateCurrentIndex = (index: number) => {
    setCurrentIndex(index % items.length);
  };

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollX.value = event.contentOffset.x;
    },
  });

  const onMomentumScrollEnd = (event: any) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    const index = Math.round(offsetX / (CARD_WIDTH + CARD_SPACING));

    // Reset position for infinite scroll
    if (index <= 0) {
      const timer = setTimeout(() => {
        scrollViewRef.current?.scrollTo({
          x: (items.length * 2 - 1) * (CARD_WIDTH + CARD_SPACING),
          animated: false,
        });
      }, 50);
      updateCurrentIndex(items.length - 1);
    } else if (index >= infiniteItems.length - 1) {
      const timer = setTimeout(() => {
        scrollViewRef.current?.scrollTo({
          x: items.length * (CARD_WIDTH + CARD_SPACING),
          animated: false,
        });
      }, 50);
      updateCurrentIndex(0);
    } else {
      updateCurrentIndex(index);
    }
  };

  const scrollToIndex = (targetIndex: number) => {
    const currentScrollIndex = Math.round(
      scrollX.value / (CARD_WIDTH + CARD_SPACING),
    );
    const currentRealIndex = currentScrollIndex % items.length;

    let scrollIndex = currentScrollIndex;

    if (targetIndex !== currentRealIndex) {
      // Find the closest path to target
      const diff = targetIndex - currentRealIndex;
      if (Math.abs(diff) <= items.length / 2) {
        scrollIndex = currentScrollIndex + diff;
      } else {
        scrollIndex =
          currentScrollIndex +
          (diff > 0 ? diff - items.length : diff + items.length);
      }

      scrollViewRef.current?.scrollTo({
        x: scrollIndex * (CARD_WIDTH + CARD_SPACING),
        animated: true,
      });
    }
  };

  const renderItem = (item: AppleWidgetItem, index: number) => {
    const animatedStyle = useAnimatedStyle(() => {
      const inputRange = [
        (index - 1) * (CARD_WIDTH + CARD_SPACING),
        index * (CARD_WIDTH + CARD_SPACING),
        (index + 1) * (CARD_WIDTH + CARD_SPACING),
      ];

      return {
        transform: [
          {
            scale: interpolate(
              scrollX.value,
              inputRange,
              [0.85, 1, 0.85],
              'clamp',
            ),
          },
        ],
        opacity: interpolate(scrollX.value, inputRange, [0.3, 1, 0.3], 'clamp'),
      };
    });

    const backgroundAnimatedStyle = useAnimatedStyle(() => {
      const inputRange = [
        (index - 1) * (CARD_WIDTH + CARD_SPACING),
        index * (CARD_WIDTH + CARD_SPACING),
        (index + 1) * (CARD_WIDTH + CARD_SPACING),
      ];

      return {
        transform: [
          {
            translateX: interpolate(
              scrollX.value,
              inputRange,
              [-10, 0, 10],
              'clamp',
            ),
          },
        ],
      };
    });

    return (
      <Animated.View
        key={`${item.id}-${index}`}
        className="h-full justify-center items-center"
        style={[
          animatedStyle,
          {
            width: CARD_WIDTH,
            marginRight: index < infiniteItems.length - 1 ? CARD_SPACING : 0,
          },
        ]}
      >
        <View className="flex-1 w-full rounded-[20px] overflow-hidden shadow-2xl border-[0.5px] border-white/10">
          <Animated.View
            className="absolute inset-0"
            style={backgroundAnimatedStyle}
          >
            <ImageBackground
              source={{ uri: item.background }}
              className="flex-1 w-full h-full"
              imageStyle={{ borderRadius: 20 }}
            >
              <View className="absolute inset-0 rounded-[20px]" />
            </ImageBackground>
          </Animated.View>

          <View className="flex-1 p-6 justify-end z-10">
            {item.content || (
              <>
                <Text className="text-2xl font-bold text-white mb-1.5 drop-shadow-lg">
                  {item.title}
                </Text>
                {item.subtitle && (
                  <Text className="text-base text-white/90 font-medium drop-shadow-md">
                    {item.subtitle}
                  </Text>
                )}
              </>
            )}
          </View>
        </View>
      </Animated.View>
    );
  };

  const renderDots = () => (
    <View className="flex-row items-center justify-center h-2 gap-1 mt-4">
      {items.map((_, index) => {
        const animatedDotStyle = useAnimatedStyle(() => {
          // Calculate current index based on scroll position
          const currentScrollIndex =
            scrollX.value / (CARD_WIDTH + CARD_SPACING);
          const currentRealIndex =
            ((currentScrollIndex % items.length) + items.length) % items.length;

          // Distance from current position
          const distance = Math.abs(index - currentRealIndex);
          const adjustedDistance = Math.min(distance, items.length - distance);

          return {
            transform: [
              {
                scale: interpolate(
                  adjustedDistance,
                  [0, 1],
                  [1.4, 0.8],
                  'clamp',
                ),
              },
            ],
            opacity: interpolate(adjustedDistance, [0, 1], [1, 0.4], 'clamp'),
            backgroundColor: '#000',
          };
        });

        return (
          <TouchableOpacity
            key={index}
            onPress={() => scrollToIndex(index)}
            className="p-1.5"
          >
            <Animated.View
              className="w-2 h-2 rounded-full"
              style={animatedDotStyle}
            />
          </TouchableOpacity>
        );
      })}
    </View>
  );

  return (
    <View className="h-[240px] bg-transparent">
      <View className="flex-1 bg-transparent">
        <View className="flex-1 bg-transparent relative">
          <Animated.ScrollView
            ref={scrollViewRef}
            horizontal={true}
            showsHorizontalScrollIndicator={false}
            pagingEnabled={true}
            decelerationRate="fast"
            snapToInterval={CARD_WIDTH + CARD_SPACING}
            snapToAlignment="start"
            style={{ backgroundColor: 'transparent' }}
            contentContainerStyle={{
              paddingHorizontal: 8,
              backgroundColor: 'transparent',
            }}
            onScroll={scrollHandler}
            onMomentumScrollEnd={onMomentumScrollEnd}
            scrollEventThrottle={16}
          >
            {infiniteItems.map((item, index) => renderItem(item, index))}
          </Animated.ScrollView>
        </View>

        {renderDots()}
      </View>
    </View>
  );
}
