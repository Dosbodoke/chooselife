import * as Haptics from 'expo-haptics';
import { Stack, useRouter } from 'expo-router';
import React from 'react';
import { Pressable, useWindowDimensions, View, ViewToken } from 'react-native';
import Animated, {
  useAnimatedRef,
  useScrollOffset,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LucideIcon } from '~/lib/icons/lucide-icon';

import { PaginationIndicator } from '~/components/organizations/BecomeMember';
import { BecomeMemberForm } from '~/components/organizations/BecomeMemberForm';
import {
  showcaseData,
  ShowcaseItem,
  ShowcaseItemData,
} from '~/components/organizations/showcase-item';

type CarouselItem =
  | { type: 'showcase'; data: ShowcaseItemData }
  | { type: 'form' };

export default function MemberShowcaseScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const animatedRef = useAnimatedRef<Animated.FlatList>();
  const scrollY = useScrollOffset(animatedRef);

  const [focusedIndex, setFocusedIndex] = React.useState<number | null>(0);

  const carouselData: CarouselItem[] = React.useMemo(
    () => [
      ...showcaseData.map(
        (itemData): CarouselItem => ({
          type: 'showcase',
          data: itemData,
        }),
      ),
      { type: 'form' },
    ],
    [],
  );

  const onViewableItemsChanged = ({
    viewableItems,
  }: {
    viewableItems: ViewToken[];
  }) => {
    if (viewableItems.length > 0) {
      const firstVisible = viewableItems[0];
      if (firstVisible.index !== null) {
        setFocusedIndex(firstVisible.index);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    }
  };

  return (
    <View className="flex-1 bg-white">
      <Stack.Screen options={{ headerShown: false }} />
      <Pressable
        onPress={router.back}
        className="absolute right-3 p-2.5 rounded-full bg-foreground/10 z-50"
        style={{
          top: insets.top + 12,
        }}
        hitSlop={12}
      >
        <LucideIcon name="X" size={20} className="fill-muted" />
      </Pressable>

      <Animated.FlatList
        ref={animatedRef}
        data={carouselData}
        keyExtractor={(_, index) => String(index)}
        snapToInterval={height}
        decelerationRate="fast"
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={{
          itemVisiblePercentThreshold: 50,
        }}
        renderItem={({ item, index }) => (
          <View style={{ width, height }}>
            {item.type === 'form' ? (
              <BecomeMemberForm isFocused={index === focusedIndex} />
            ) : (
              <ShowcaseItem
                item={item.data}
                index={index}
                scrollY={scrollY}
                itemSize={height}
              />
            )}
          </View>
        )}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        bounces={false}
      />

      {/* Pagination indicators */}
      <View
        className="absolute top-1/2 right-3 gap-1.5 z-50"
        pointerEvents="none"
      >
        {carouselData.map((_, index) => (
          <PaginationIndicator
            key={index}
            index={index}
            scrollY={scrollY}
            itemSize={height}
            isOnDarkBackground={focusedIndex === carouselData.length - 1}
          />
        ))}
      </View>
    </View>
  );
}
