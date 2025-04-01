import * as Haptics from 'expo-haptics';
import { atom, useSetAtom } from 'jotai';
import { icons } from 'lucide-react-native';
import React, { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  LayoutChangeEvent,
  ScrollView,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { type HighlineCategory } from '~/hooks/use-highline';
import { LucideIcon } from '~/lib/icons/lucide-icon';
import { cn } from '~/lib/utils';

import { Text } from '~/components/ui/text';

import { SafeAreaOfflineView } from '../offline-banner';

// Keep track of the handle height so the Highlited marker card can be positioned correctly and the minimum snap point fits only the handler
export const exploreHeaderHeightAtom = atom<number>(0);

const ExploreHeader: React.FC<{
  onSearchChange: (text: string) => void;
  onCategoryChange: (category: HighlineCategory | null) => void;
}> = ({ onSearchChange, onCategoryChange }) => {
  const { t } = useTranslation();

  const setExploreHeaderHeight = useSetAtom(exploreHeaderHeightAtom);

  const categories: Array<{
    category: HighlineCategory;
    name: string;
    icon: keyof typeof icons;
  }> = useMemo(
    () => [
      {
        category: 'favorites',
        name: t('components.map.explore-header.categories.favorites'),
        icon: 'Heart',
      },
      {
        category: 'big line',
        name: t('components.map.explore-header.categories.bigLine'),
        icon: 'Ruler',
      },
      {
        category: 'rigged',
        name: t('components.map.explore-header.categories.rigged'),
        icon: 'Activity',
      },
      {
        category: 'unrigged',
        name: t('components.map.explore-header.categories.unrigged'),
        icon: 'PowerOff',
      },
      {
        category: 'planned',
        name: t('components.map.explore-header.categories.planned'),
        icon: 'CalendarClock',
      },
    ],
    [t],
  );

  const [search, setSearch] = useState('');
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const searchInputRef = useRef<TextInput>(null);

  // Shared values for the indicator’s horizontal position and width
  const indicatorX = useSharedValue(0);
  const indicatorWidth = useSharedValue(0);

  // Store each category’s layout (x and width)
  const categoryLayouts = useRef<Array<{ x: number; width: number }>>([]);

  // Create an animated style for the indicator using our shared values.
  const animatedIndicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: indicatorX.value }],
    width: indicatorWidth.value,
  }));

  const handleSearchChange = (text: string) => {
    setSearch(text);
    onSearchChange(text);
  };

  const handleFocusSearchInput = () => {
    searchInputRef.current?.focus();
  };

  const selectCategory = (index: number) => {
    // Unselect if tapping the active category
    if (activeIndex === index) {
      setActiveIndex(null);
      onCategoryChange(null);
      // Optionally animate the indicator out (e.g. shrink width)
      indicatorWidth.value = withTiming(0, { duration: 250 });
      return;
    }

    setActiveIndex(index);
    const layout = categoryLayouts.current[index];
    if (layout) {
      // Animate the indicator to the new x position and width
      indicatorX.value = withTiming(layout.x, { duration: 250 });
      indicatorWidth.value = withTiming(layout.width, { duration: 250 });
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onCategoryChange(categories[index].category);

    // Optionally scroll the category into view.
    scrollRef.current?.scrollTo({ x: layout.x - 16, y: 0, animated: true });
  };

  return (
    <SafeAreaOfflineView>
      <View
        className="bg-background pt-2 pb-4 shadow gap-6 px-6"
        onLayout={(e) => setExploreHeaderHeight(e.nativeEvent.layout.height)}
      >
        <View className="flex-row items-center justify-between gap-3">
          <TouchableOpacity
            className="flex-1 flex-row bg-background gap-3 p-4 items-center border-hairline border-muted rounded-3xl shadow-md"
            onPress={handleFocusSearchInput}
          >
            <LucideIcon name="Search" className="size-6 text-primary" />
            <TextInput
              ref={searchInputRef}
              placeholder={t('components.map.explore-header.searchPlaceholder')}
              value={search}
              onChangeText={handleSearchChange}
              className="flex-1"
            />
          </TouchableOpacity>
        </View>

        <View className="relative">
          <ScrollView
            horizontal
            ref={scrollRef}
            showsHorizontalScrollIndicator={false}
            contentContainerClassName="relative items-center px-4 pb-1"
          >
            {categories.map((item, index) => (
              <TouchableOpacity
                key={item.category}
                onPress={() => selectCategory(index)}
                // Capture the layout of this category
                onLayout={(event: LayoutChangeEvent) => {
                  const { x, width } = event.nativeEvent.layout;
                  categoryLayouts.current[index] = { x, width };
                  // If this category is active on first render, update the indicator immediately.
                  if (activeIndex === index) {
                    indicatorX.value = x;
                    indicatorWidth.value = width;
                  }
                }}
                style={{
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginHorizontal: 8,
                }}
              >
                <LucideIcon
                  name={item.icon}
                  className={cn(
                    'size-6',
                    activeIndex === index
                      ? 'text-primary'
                      : 'text-muted-foreground',
                  )}
                />
                <Text
                  className={cn(
                    activeIndex === index
                      ? 'text-primary'
                      : 'text-muted-foreground',
                  )}
                >
                  {item.name}
                </Text>
              </TouchableOpacity>
            ))}

            {activeIndex !== null && (
              <Animated.View
                className="h-[2px] bg-primary absolute bottom-0"
                style={animatedIndicatorStyle}
              />
            )}
          </ScrollView>
        </View>
      </View>
    </SafeAreaOfflineView>
  );
};

export default ExploreHeader;
