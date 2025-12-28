import { Stack } from 'expo-router';
import { CalendarDaysIcon } from 'lucide-react-native';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, View } from 'react-native';
import Animated, { LinearTransition } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useI18n } from '~/context/i18n';
import { 
  useEvents, 
  formatMonthHeader, 
  groupEventsByMonth,
  type CategoryFilterType,
  CATEGORY_FILTERS,
  extractCountryOptions,
  filterEvents,
  SupabaseProvider,
} from "@chooselife/ui"

import { EventCard, EventCardSkeleton } from '~/components/event-card';
import { Icon } from '~/components/ui/icon';
import { Text } from '~/components/ui/text';
import { DAMPING } from '~/utils/constants';
import { supabase } from '~/lib/supabase';

export const _layoutAnimation = LinearTransition.springify().damping(DAMPING);

/** Filter chip component */
const FilterChip: React.FC<{
  label: string;
  isSelected: boolean;
  dotColor?: string;
  onPress: () => void;
}> = ({ label, isSelected, dotColor, onPress }) => (
  <Pressable
    onPress={onPress}
    className={`flex-row items-center gap-1.5 px-4 py-2 rounded-full border ${
      isSelected
        ? 'bg-foreground border-foreground'
        : 'bg-white border-gray-200'
    }`}
  >
    {dotColor && <View className={`size-2 rounded-full ${dotColor}`} />}
    <Text
      className={`text-sm font-medium ${
        isSelected ? 'text-background' : 'text-foreground'
      }`}
    >
      {label}
    </Text>
  </Pressable>
);

export default function EventsPageWrapper() {
  return (
    <SupabaseProvider supabase={supabase}>
      <EventsPage />
    </SupabaseProvider>
  )
}

const EventsPage = () => {
  const { t } = useTranslation();
  const { locale } = useI18n();
  const { filteredEvents, query } = useEvents();
  
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilterType>('all');
  const [countryFilter, setCountryFilter] = useState<string>('all');

  // Extract unique countries from events with flag emojis
  const countryOptions = useMemo(() => {
    return extractCountryOptions(filteredEvents);
  }, [filteredEvents]);

  // Apply local filters (category + country)
  const locallyFilteredEvents = useMemo(() => {
    return filterEvents(filteredEvents, categoryFilter, countryFilter);
  }, [filteredEvents, categoryFilter, countryFilter]);


  // Group filtered events by month
  const eventsByMonth = useMemo(() => {
    return groupEventsByMonth(locallyFilteredEvents);
  }, [locallyFilteredEvents]);

  const monthKeys = Object.keys(eventsByMonth).sort();
  const hasActiveFilters = categoryFilter !== 'all' || countryFilter !== 'all';

  return (
    <>
      <Stack.Screen options={{ title: t('app.events.title') }} />
      <SafeAreaView className="flex-1 bg-gray-100" edges={['left', 'right', 'bottom']}>
        {/* Filter Section */}
        <View className="bg-white border-b border-gray-100">
          {/* Category Filter Chips */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerClassName="px-4 py-3 gap-2"
          >
            {CATEGORY_FILTERS.map((filter) => (
              <FilterChip
                key={filter.key}
                label={t(filter.labelKey)}
                isSelected={categoryFilter === filter.key}
                dotColor={filter.dotColor}
                onPress={() => setCategoryFilter(filter.key)}
              />
            ))}
          </ScrollView>

          {/* Country Filter Chips */}
          {countryOptions.length > 0 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerClassName="px-4 pb-3 gap-2"
            >
              <FilterChip
                label={t('app.events.filters.allCountries')}
                isSelected={countryFilter === 'all'}
                onPress={() => setCountryFilter('all')}
              />
              {countryOptions.map((country) => (
                <FilterChip
                  key={country.name}
                  label={country.label}
                  isSelected={countryFilter === country.name}
                  onPress={() => setCountryFilter(country.name)}
                />
              ))}
            </ScrollView>
          )}
        </View>

        {/* Events List */}
        <ScrollView
          className="flex-1"
          contentContainerClassName="py-4 px-4"
          showsVerticalScrollIndicator={false}
        >
          <View>
            {/* --- Loading State --- */}
            {query.isPending ? (
              <View className="gap-3">
                <EventCardSkeleton />
                <EventCardSkeleton />
                <EventCardSkeleton />
                <EventCardSkeleton />
              </View>
            ) : /* --- No Events State --- */
            monthKeys.length === 0 ? (
              <View className="flex-1 items-center justify-center py-20 gap-4">
                <View className="bg-muted/30 rounded-full p-5">
                  <Icon
                    as={CalendarDaysIcon}
                    className="size-10 text-muted-foreground"
                  />
                </View>
                <Text className="text-center text-muted-foreground text-base">
                  {hasActiveFilters
                    ? t('app.events.noEventsFiltered')
                    : t('app.events.noEvents')}
                </Text>
              </View>
            ) : (
              /* --- Loaded State --- */
              <View className="gap-6">
                {monthKeys.map((monthKey) => (
                  <View key={monthKey}>
                    {/* Month Section Header */}
                    <Animated.View
                      layout={_layoutAnimation}
                      className="flex-row items-center mb-3"
                    >
                      <Text className="text-xl font-bold text-foreground tracking-tight">
                        {formatMonthHeader(monthKey, locale)}
                      </Text>
                    </Animated.View>

                    {/* Events List */}
                    <View className="gap-3">
                      {(eventsByMonth?.[monthKey] ?? []).map((e) => (
                        <EventCard key={e.id} event={e} />
                      ))}
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    </>
  );
}
