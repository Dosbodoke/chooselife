import { BottomSheetTextInput } from '@gorhom/bottom-sheet';
import { useMapStore } from '~/store/map-store';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import {
  ActivityIcon,
  CalendarClockIcon,
  HeartIcon,
  PlusIcon,
  PowerOffIcon,
  RulerIcon,
  SearchIcon,
  XIcon,
} from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  LayoutChangeEvent,
  ScrollView,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useShallow } from 'zustand/react/shallow';

import { type HighlineCategory, useHighline } from '~/hooks/use-highline';
import { cn } from '~/lib/utils';
import { DEFAULT_LATITUDE, DEFAULT_LONGITUDE, _layoutAnimation } from '~/utils/constants';

import { Button } from '../ui/button';
import { Icon } from '../ui/icon';
import { Text } from '../ui/text';
import { WeatherSummary } from './weather-info-card';

// Categories config
const CATEGORIES: { category: HighlineCategory; icon: typeof HeartIcon }[] = [
  { category: 'favorites', icon: HeartIcon },
  { category: 'big line', icon: RulerIcon },
  { category: 'rigged', icon: ActivityIcon },
  { category: 'unrigged', icon: PowerOffIcon },
  { category: 'planned', icon: CalendarClockIcon },
];

/**
 * ExploreHeader - Bottom sheet handle content
 * Reads all data from Zustand store and React Query hooks.
 * This component is memoized and should only be used within a gorhom/bottom-sheet handleComponent.
 */
const ExploreHeader = React.memo(() => {
  const { t } = useTranslation();
  const setBottomSheetHandlerHeight = useMapStore(
    (state) => state.setBottomSheeHandlerHeight,
  );
  
  // Read search/category from store
  const searchQuery = useMapStore((state) => state.searchQuery);
  const setSearchQuery = useMapStore((state) => state.setSearchQuery);
  const activeCategory = useMapStore((state) => state.activeCategory);
  const setActiveCategory = useMapStore((state) => state.setActiveCategory);
  
  // Local input state for immediate feedback, debounce store update
  const [localInput, setLocalInput] = useState(searchQuery);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  const handleInputChange = useCallback((text: string) => {
    setLocalInput(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setSearchQuery(text), 300);
  }, [setSearchQuery]);
  
  const handleClearInput = useCallback(() => {
    setLocalInput('');
    setSearchQuery('');
  }, [setSearchQuery]);
  
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);
  
  // Sync local input if store changes externally
  useEffect(() => {
    setLocalInput(searchQuery);
  }, [searchQuery]);
  
  const camera = useMapStore(useShallow((state) => state.camera));
  const [weatherCoords, setWeatherCoords] = useState({
    latitude: camera?.center?.[1] ?? DEFAULT_LATITUDE,
    longitude: camera?.center?.[0] ?? DEFAULT_LONGITUDE,
  });
  
  useEffect(() => {
    const latitude = camera?.center?.[1] ?? DEFAULT_LATITUDE;
    const longitude = camera?.center?.[0] ?? DEFAULT_LONGITUDE;
    const timeoutId = setTimeout(() => {
      setWeatherCoords({ latitude, longitude });
    }, 2000); // Only update after 2s of no camera changes
    return () => clearTimeout(timeoutId);
  }, [camera?.center]);
  
  const { highlines, isLoading } = useHighline({ searchTerm: searchQuery, category: activeCategory });

  const categories = useMemo(
    () => CATEGORIES.map((c) => ({
      ...c,
      name: t(`components.map.explore-header.categories.${c.category === 'big line' ? 'bigLine' : c.category}`),
    })),
    [t],
  );

  const scrollRef = useRef<ScrollView>(null);
  const categoryLayouts = useRef<Array<{ x: number; width: number }>>([]);
  const indicatorX = useSharedValue(0);
  const indicatorWidth = useSharedValue(0);
  const animatedIndicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: indicatorX.value }],
    width: indicatorWidth.value,
  }));

  const handleCategoryPress = useCallback((index: number) => {
    const layout = categoryLayouts.current[index];
    const category = CATEGORIES[index].category;
    
    if (activeCategory === category) {
      setActiveCategory(null);
      indicatorWidth.value = withTiming(0, { duration: 250 });
    } else {
      setActiveCategory(category);
      if (layout) {
        indicatorX.value = withTiming(layout.x, { duration: 250 });
        indicatorWidth.value = withTiming(layout.width, { duration: 250 });
        scrollRef.current?.scrollTo({ x: layout.x - 16, y: 0, animated: true });
      }
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [activeCategory, setActiveCategory, indicatorWidth, indicatorX]);

  return (
    <View
      onLayout={(e) => setBottomSheetHandlerHeight(e.nativeEvent.layout.height)}
      className="gap-3 pb-2 bg-background"
    >
      {/* Drag Handle */}
      <View className="pt-3">
        <View className="mx-auto w-10 h-1 bg-muted-foreground rounded-md" />
      </View>

      {/* Header Row */}
      <View className="flex-row justify-between items-center px-4">
        <View className="flex-row items-center gap-1">
          <Animated.Text
            layout={_layoutAnimation}
            className={cn(
              'text-center font-extrabold text-3xl tabular-nums',
              isLoading ? 'text-muted-foreground' : 'text-primary',
            )}
          >
            {isLoading ? <ActivityIndicator /> : highlines.length}
          </Animated.Text>
          <Animated.Text
            layout={_layoutAnimation}
            className={cn(
              'text-center font-extrabold text-3xl',
              isLoading ? 'text-muted-foreground' : 'text-primary',
            )}
          >
            highline{highlines.length === 1 ? '' : 's'}
          </Animated.Text>
        </View>
        <View className="flex-row items-center gap-3">
          <WeatherSummary
            latitude={weatherCoords.latitude}
            longitude={weatherCoords.longitude}
          />
          <AddHighlineButton />
        </View>
      </View>

      {/* Search Bar */}
      <View className="px-4">
        <View className="flex-row bg-muted gap-3 p-3 items-center border-hairline border-muted rounded-2xl">
          <Icon
            as={SearchIcon}
            strokeWidth={3}
            className="size-5 text-muted-foreground"
          />
          <BottomSheetTextInput
            placeholder={t('components.map.explore-header.searchPlaceholder')}
            value={localInput}
            onChangeText={handleInputChange}
            className="flex-1 text-primary font-semibold"
            placeholderTextColor="#9ca3af"
          />
          {localInput.length > 0 && (
            <TouchableOpacity onPress={handleClearInput} hitSlop={8}>
              <Icon
                as={XIcon}
                strokeWidth={2}
                className="size-5 text-muted-foreground"
              />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Category Chips */}
      <View className="relative">
        <ScrollView
          horizontal
          ref={scrollRef}
          showsHorizontalScrollIndicator={false}
          contentContainerClassName="relative items-center px-4 gap-2"
        >
          {categories.map((item, index) => (
            <TouchableOpacity
              key={item.category}
              onPress={() => handleCategoryPress(index)}
              onLayout={(event: LayoutChangeEvent) => {
                const { x, width } = event.nativeEvent.layout;
                categoryLayouts.current[index] = { x, width };
              }}
              className="bg-background flex-row items-center justify-center gap-2 p-1 pb-2 px-2 rounded-lg"
            >
              <Icon
                as={item.icon}
                className={cn(
                  'size-4',
                  activeCategory === item.category ? 'text-primary' : 'text-muted-foreground',
                )}
              />
              <Text
                className={cn(
                  'text-sm font-semibold',
                  activeCategory === item.category ? 'text-primary' : 'text-muted-foreground',
                )}
              >
                {item.name}
              </Text>
            </TouchableOpacity>
          ))}
          {activeCategory !== null && (
            <Animated.View
              className="h-[2px] bg-blue-500 absolute bottom-0"
              style={animatedIndicatorStyle}
            />
          )}
        </ScrollView>
      </View>
    </View>
  );
});

ExploreHeader.displayName = 'ExploreHeader';

// Add Highline Button
const AddHighlineButton: React.FC = () => {
  const router = useRouter();
  const camera = useMapStore((state) => state.camera);

  return (
    <Button
      size="icon"
      className="rounded-full"
      onPress={() => {
        router.push(
          `/location-picker?lat=${camera.center[1]}&lng=${camera.center[0]}&zoom=${camera.zoom}`,
        );
      }}
    >
      <Icon as={PlusIcon} className="size-5 text-primary-foreground" />
    </Button>
  );
};

export default ExploreHeader;
