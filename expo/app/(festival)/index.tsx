import BottomSheet, {
  BottomSheetBackdrop,
  BottomSheetBackdropProps,
  BottomSheetView,
} from '@gorhom/bottom-sheet';
import * as Notifications from 'expo-notifications';
import AsyncStorage from 'expo-sqlite/kv-store';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  View,
} from 'react-native';
import { LinearTransition } from 'react-native-reanimated';

import { cn } from '~/lib/utils';
import { scheduleData, TScheduleData } from '~/utils/festival-data';

import { Card, CardContent } from '~/components/ui/card';
import { Text } from '~/components/ui/text';

// Constants
const CONSTANTS = {
  DAMPING: 80,
  NOTIFICATION_ADVANCE_TIME: 60 * 60 * 1000, // 1 hour in milliseconds
  TUTORIAL_DELAY: 1000,
  STORAGE_KEYS: {
    FAVORITES: '@event_favorites',
    TUTORIAL_SHOWN: '@tutorial_shown',
  },
  EVENT_DATES: [
    '2025-06-19',
    '2025-06-20',
    '2025-06-21',
    '2025-06-22',
  ] as const,
} as const;

// Types
type EventDay = (typeof CONSTANTS.EVENT_DATES)[number];
type EventType = 'workshop' | 'competition';
type DayTabId = 'all' | EventDay;
type TypeTabId = EventType;

interface DayTab {
  id: DayTabId;
  labelKey: string;
}

interface TypeTab {
  id: TypeTabId;
  labelKey: string;
  icon: string;
}

interface ScheduleCardProps {
  data: TScheduleData;
  isFavorite: boolean;
  onToggleFavorite: () => void;
}

interface EventsGroupedByDay {
  [key: string]: TScheduleData[];
}

// Configuration
const DAY_TABS: DayTab[] = [
  { id: 'all', labelKey: 'app.(festival).index.events.tabs.all' },
  { id: '2025-06-19', labelKey: 'app.(festival).index.events.tabs.thursday' },
  { id: '2025-06-20', labelKey: 'app.(festival).index.events.tabs.friday' },
  { id: '2025-06-21', labelKey: 'app.(festival).index.events.tabs.saturday' },
  { id: '2025-06-22', labelKey: 'app.(festival).index.events.tabs.sunday' },
];

const TYPE_TABS: TypeTab[] = [
  {
    id: 'workshop',
    labelKey: 'app.(festival).index.events.types.workshops',
    icon: '🎯',
  },
  {
    id: 'competition',
    labelKey: 'app.(festival).index.events.types.competitions',
    icon: '🏆',
  },
];

// Layout animation
export const _layoutAnimation = LinearTransition.springify().damping(
  CONSTANTS.DAMPING,
);

// Utility functions
const formatDateDisplay = (
  dateString: string,
  t: (key: string) => string,
): string => {
  const dateMap: Record<string, string> = {
    '2025-06-19': t('app.(festival).index.events.dates.thursday'),
    '2025-06-20': t('app.(festival).index.events.dates.friday'),
    '2025-06-21': t('app.(festival).index.events.dates.saturday'),
    '2025-06-22': t('app.(festival).index.events.dates.sunday'),
  };
  return dateMap[dateString] || dateString;
};

const getCurrentDay = (): DayTabId => {
  const today = new Date();
  const currentDateString = today.toISOString().split('T')[0] as EventDay;

  return CONSTANTS.EVENT_DATES.includes(currentDateString)
    ? currentDateString
    : 'all';
};

const parseEventTime = (eventDay: string, startTime: string): Date | null => {
  const [year, month, day] = eventDay.split('-').map(Number);
  const timeMatch = startTime.match(/(\d{1,2}):(\d{2})/);

  if (!timeMatch) return null;

  const [, hours, minutes] = timeMatch;
  return new Date(
    year,
    month - 1,
    day,
    parseInt(hours, 10),
    parseInt(minutes, 10),
  );
};

const getNotificationDate = (
  eventDay: string,
  startTime: string,
): Date | null => {
  const eventDate = parseEventTime(eventDay, startTime);
  if (!eventDate) return null;

  const notificationDate = new Date(
    eventDate.getTime() - CONSTANTS.NOTIFICATION_ADVANCE_TIME,
  );

  // Don't schedule notifications for past events
  return notificationDate < new Date() ? null : notificationDate;
};

// Hooks
const useFavorites = () => {
  const [favorites, setFavorites] = useState<Set<number>>(new Set());
  const [isLoading, setIsLoading] = useState(true);

  const loadFavorites = useCallback(async () => {
    try {
      const storedFavorites = await AsyncStorage.getItem(
        CONSTANTS.STORAGE_KEYS.FAVORITES,
      );
      if (storedFavorites) {
        const favoritesArray: number[] = JSON.parse(storedFavorites);
        setFavorites(new Set(favoritesArray));
      }
    } catch (error) {
      console.error('Error loading favorites:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const saveFavorites = useCallback(async (newFavorites: Set<number>) => {
    try {
      const favoritesArray = Array.from(newFavorites);
      await AsyncStorage.setItem(
        CONSTANTS.STORAGE_KEYS.FAVORITES,
        JSON.stringify(favoritesArray),
      );
    } catch (error) {
      console.error('Error saving favorites:', error);
    }
  }, []);

  const toggleFavorite = useCallback(
    async (
      eventId: number,
      eventData: TScheduleData,
      t: (key: string, options?: Record<string, unknown>) => string,
    ) => {
      const newFavorites = new Set(favorites);
      const isCurrentlyFavorite = favorites.has(eventId);

      if (isCurrentlyFavorite) {
        newFavorites.delete(eventId);
        await Notifications.cancelScheduledNotificationAsync(
          eventId.toString(),
        );
      } else {
        newFavorites.add(eventId);

        if (eventData.day) {
          const notificationDate = getNotificationDate(
            eventData.day,
            eventData.startAt,
          );

          if (notificationDate) {
            await Notifications.scheduleNotificationAsync({
              identifier: eventId.toString(),
              content: {
                title: t('app.(festival).index.events.notification.title'),
                body: t('app.(festival).index.events.notification.body', {
                  title: eventData.title,
                  time: eventData.startAt,
                  location: eventData.location || '',
                }),
              },
              trigger: {
                type: Notifications.SchedulableTriggerInputTypes.DATE,
                date: notificationDate,
              },
            });

            Alert.alert(
              t('app.(festival).index.events.alert.title'),
              t('app.(festival).index.events.alert.message', {
                title: eventData.title,
              }),
              [{ text: t('app.(festival).index.events.alert.button') }],
            );
          }
        }
      }

      setFavorites(newFavorites);
      await saveFavorites(newFavorites);
    },
    [favorites, saveFavorites],
  );

  useEffect(() => {
    loadFavorites();
  }, [loadFavorites]);

  return {
    favorites,
    isLoading,
    toggleFavorite,
  };
};

const useFilteredEvents = (
  activeDay: DayTabId,
  activeType: TypeTabId | null,
) => {
  return useMemo(() => {
    return scheduleData.filter((item) => {
      const dayMatch = activeDay === 'all' || item.day === activeDay;
      const typeMatch = activeType === null || item.type === activeType;
      return dayMatch && typeMatch;
    });
  }, [activeDay, activeType]);
};

const useGroupedEvents = (filteredData: TScheduleData[]) => {
  return useMemo(() => {
    const grouped = filteredData.reduce<EventsGroupedByDay>((acc, item) => {
      const day = item.day || 'no-date';
      if (!acc[day]) {
        acc[day] = [];
      }
      acc[day].push(item);
      return acc;
    }, {});

    const sortedDays = Object.keys(grouped).sort();
    return { grouped, sortedDays };
  }, [filteredData]);
};

// Components
const EventTypeIcon: React.FC<{ type?: string }> = ({ type }) => {
  const iconMap: Record<string, string> = {
    workshop: '🎯',
    competition: '🏆',
  };
  return <Text className="text-base">{iconMap[type || ''] || '📅'}</Text>;
};

const EventTypeBadge: React.FC<{
  type?: string;
  t: (key: string) => string;
}> = ({ type, t }) => {
  const getTypeColor = (eventType?: string) => {
    switch (eventType) {
      case 'workshop':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'competition':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getTypeLabel = (eventType?: string) => {
    switch (eventType) {
      case 'workshop':
        return t('app.(festival).index.events.types.workshop');
      case 'competition':
        return t('app.(festival).index.events.types.competition');
      default:
        return t('app.(festival).index.events.types.event');
    }
  };

  if (!type) return null;

  return (
    <View className={cn('px-2 py-1 rounded-full border', getTypeColor(type))}>
      <Text className="text-xs font-medium capitalize">
        {getTypeLabel(type)}
      </Text>
    </View>
  );
};

const FavoriteButton: React.FC<{
  isFavorite: boolean;
  onPress: () => void;
}> = ({ isFavorite, onPress }) => (
  <TouchableOpacity
    onPress={onPress}
    className={cn(
      'w-10 h-10 rounded-full items-center justify-center',
      isFavorite
        ? 'bg-amber-100 border-2 border-amber-300'
        : 'bg-gray-100 border-2 border-gray-200',
    )}
  >
    <Text className="text-lg">{isFavorite ? '⭐' : '☆'}</Text>
  </TouchableOpacity>
);

const FilterTabs: React.FC<{
  tabs: DayTab[] | TypeTab[];
  activeId: string | null;
  onTabPress: (id: string) => void;
  title: string;
  allowToggle?: boolean;
  t: (key: string) => string;
}> = ({ tabs, activeId, onTabPress, title, allowToggle = false, t }) => (
  <View className="px-4 mb-4">
    <Text className="text-lg font-semibold mb-3 text-gray-900">{title}</Text>
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <View className="flex-row gap-2">
        {tabs.map((tab) => {
          const isActive = activeId === tab.id;
          const colorClasses = isActive
            ? 'bg-blue-100 border-blue-300'
            : 'bg-white border-gray-300';
          const textColorClasses = isActive ? 'text-blue-800' : 'text-gray-600';

          return (
            <TouchableOpacity
              key={tab.id}
              onPress={() => onTabPress(allowToggle && isActive ? '' : tab.id)}
              className={cn(
                'flex-row items-center px-4 py-2 rounded-full border',
                colorClasses,
              )}
            >
              {'icon' in tab && (
                <Text className="text-sm mr-1">{tab.icon}</Text>
              )}
              {!('icon' in tab) && <Text className="text-sm mr-1">📅</Text>}
              <Text className={cn('text-sm font-medium', textColorClasses)}>
                {t(tab.labelKey)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </ScrollView>
  </View>
);

export const ScheduleCard: React.FC<ScheduleCardProps> = ({
  data,
  isFavorite,
  onToggleFavorite,
}) => {
  const { t } = useTranslation();

  return (
    <Card className="bg-white shadow-sm border border-gray-200">
      <CardContent className="p-3">
        {/* Header with time, type, and favorite button */}
        <View className="flex-row justify-between items-start mb-2">
          <View className="flex-row items-center flex-1">
            <View className="w-10 h-10 bg-blue-50 rounded-lg items-center justify-center mr-3">
              <EventTypeIcon type={data.type} />
            </View>
            <View className="flex-1">
              <Text className="text-base font-bold text-blue-600">
                {data.startAt}
              </Text>
              <Text className="text-xs text-gray-500">
                {t('app.(festival).index.events.card.time')}
              </Text>
            </View>
          </View>

          <View className="flex-row items-center gap-2">
            <EventTypeBadge type={data.type} t={t} />
            <FavoriteButton
              isFavorite={isFavorite}
              onPress={onToggleFavorite}
            />
          </View>
        </View>

        {/* Title */}
        <Text className="text-base font-semibold text-gray-900 mb-2 leading-tight">
          {data.title}
        </Text>

        {/* Details */}
        <View className="gap-1">
          {data.instructor && (
            <View className="flex-row items-center gap-1">
              <Text className="text-sm text-gray-500">
                {t('app.(festival).index.events.card.instructor')}:
              </Text>
              <Text className="text-sm font-medium text-gray-700 flex-1">
                {data.instructor}
              </Text>
            </View>
          )}

          {data.location && (
            <View className="flex-row items-center gap-1">
              <Text className="text-sm text-gray-500">
                {t('app.(festival).index.events.card.location')}:
              </Text>
              <Text className="text-sm font-medium text-gray-700 flex-1">
                {data.location}
              </Text>
            </View>
          )}
        </View>
      </CardContent>
    </Card>
  );
};

const EventsList: React.FC<{
  activeDay: DayTabId;
  filteredData: TScheduleData[];
  groupedEvents: EventsGroupedByDay;
  sortedDays: string[];
  favorites: Set<number>;
  onToggleFavorite: (eventId: number, eventData: TScheduleData) => void;
  t: (key: string) => string;
}> = ({
  activeDay,
  filteredData,
  groupedEvents,
  sortedDays,
  favorites,
  onToggleFavorite,
  t,
}) => {
  if (activeDay === 'all') {
    return (
      <View className="px-4 gap-6">
        {sortedDays.map((day) => (
          <View key={day}>
            <View className="mb-4">
              <Text className="text-xl font-bold text-gray-900 mb-1">
                {formatDateDisplay(day, t)}
              </Text>
              <View className="h-1 w-16 bg-blue-500 rounded-full" />
            </View>
            <View className="gap-4 mb-6">
              {groupedEvents[day].map((data) => (
                <ScheduleCard
                  key={data.id}
                  data={data}
                  isFavorite={favorites.has(data.id)}
                  onToggleFavorite={() => onToggleFavorite(data.id, data)}
                />
              ))}
            </View>
          </View>
        ))}
      </View>
    );
  }

  return (
    <View className="px-4 gap-4">
      {filteredData.map((data) => (
        <ScheduleCard
          key={data.id}
          data={data}
          isFavorite={favorites.has(data.id)}
          onToggleFavorite={() => onToggleFavorite(data.id, data)}
        />
      ))}
    </View>
  );
};

const BottomSheetTutorial: React.FC = () => {
  const bottomSheetRef = useRef<BottomSheet>(null);
  const { t } = useTranslation();

  useEffect(() => {
    const checkAndShowTutorial = async () => {
      try {
        const tutorialShown = await AsyncStorage.getItem(
          CONSTANTS.STORAGE_KEYS.TUTORIAL_SHOWN,
        );
        if (!tutorialShown) {
          setTimeout(() => {
            bottomSheetRef.current?.expand();
          }, CONSTANTS.TUTORIAL_DELAY);
        }
      } catch (error) {
        console.error('Error checking tutorial status:', error);
      }
    };

    checkAndShowTutorial();
  }, []);

  const handleCloseTutorial = useCallback(async () => {
    try {
      await AsyncStorage.setItem(CONSTANTS.STORAGE_KEYS.TUTORIAL_SHOWN, 'true');
      bottomSheetRef.current?.close();
    } catch (error) {
      console.error('Error marking tutorial as shown:', error);
    }
  }, []);

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        pressBehavior="close"
      />
    ),
    [],
  );

  return (
    <BottomSheet
      ref={bottomSheetRef}
      index={-1}
      enablePanDownToClose={true}
      backdropComponent={renderBackdrop}
      backgroundStyle={{ backgroundColor: '#f8fafc' }}
      handleIndicatorStyle={{ backgroundColor: '#64748b' }}
    >
      <BottomSheetView className="flex-1 px-6 py-4 pb-8 gap-6">
        <View className="items-center">
          <View className="w-16 h-16 bg-amber-100 rounded-full items-center justify-center mb-4">
            <Text className="text-3xl">⭐</Text>
          </View>
          <Text className="text-xl font-bold text-gray-900 text-center mb-2">
            {t('app.(festival).index.tutorial.title')}
          </Text>
          <Text className="text-sm text-gray-600 text-center">
            {t('app.(festival).index.tutorial.subtitle')}
          </Text>
        </View>

        <View className="gap-4 mb-6">
          <View className="flex-row items-start gap-3">
            <View className="w-8 h-8 bg-blue-100 rounded-full items-center justify-center mt-1">
              <Text className="text-base">⭐</Text>
            </View>
            <View className="flex-1">
              <Text className="font-semibold text-gray-900 mb-1">
                {t('app.(festival).index.tutorial.favorite.title')}
              </Text>
              <Text className="text-sm text-gray-600">
                {t('app.(festival).index.tutorial.favorite.description')}
              </Text>
            </View>
          </View>

          <View className="flex-row items-start gap-3">
            <View className="w-8 h-8 bg-green-100 rounded-full items-center justify-center mt-1">
              <Text className="text-base">🔔</Text>
            </View>
            <View className="flex-1">
              <Text className="font-semibold text-gray-900 mb-1">
                {t('app.(festival).index.tutorial.notification.title')}
              </Text>
              <Text className="text-sm text-gray-600">
                {t('app.(festival).index.tutorial.notification.description')}
              </Text>
            </View>
          </View>
        </View>

        <TouchableOpacity
          onPress={handleCloseTutorial}
          className="bg-blue-600 rounded-lg py-3 px-6 items-center"
        >
          <Text className="text-white font-semibold">
            {t('app.(festival).index.tutorial.button')}
          </Text>
        </TouchableOpacity>
      </BottomSheetView>
    </BottomSheet>
  );
};

export default function SchedulePage() {
  const { t } = useTranslation();
  const [activeDay, setActiveDay] = useState<DayTabId>(getCurrentDay());
  const [activeType, setActiveType] = useState<TypeTabId | null>(null);

  const { favorites, isLoading, toggleFavorite } = useFavorites();

  const filteredData = useFilteredEvents(activeDay, activeType);
  const { grouped: groupedEvents, sortedDays } = useGroupedEvents(filteredData);

  const handleToggleFavorite = useCallback(
    (eventId: number, eventData: TScheduleData) => {
      toggleFavorite(eventId, eventData, t);
    },
    [toggleFavorite, t],
  );

  const handleDayTabPress = useCallback((tabId: string) => {
    setActiveDay(tabId as DayTabId);
  }, []);

  const handleTypeTabPress = useCallback((tabId: string) => {
    setActiveType((current) =>
      current === tabId ? null : (tabId as TypeTabId),
    );
  }, []);

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center">
        <Text className="text-lg text-gray-600">
          {t('app.(festival).index.events.loading')}
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <>
      <SafeAreaView className="flex-1">
        <ScrollView contentContainerClassName="pt-6 bg-gray-50">
          <FilterTabs
            tabs={DAY_TABS}
            activeId={activeDay}
            onTabPress={handleDayTabPress}
            title={t('app.(festival).index.events.dayFilter.title')}
            t={t}
          />

          <FilterTabs
            tabs={TYPE_TABS}
            activeId={activeType}
            onTabPress={handleTypeTabPress}
            title={t('app.(festival).index.events.typeFilter.title')}
            allowToggle={true}
            t={t}
          />

          <EventsList
            activeDay={activeDay}
            filteredData={filteredData}
            groupedEvents={groupedEvents}
            sortedDays={sortedDays}
            favorites={favorites}
            onToggleFavorite={handleToggleFavorite}
            t={t}
          />
        </ScrollView>
      </SafeAreaView>

      <BottomSheetTutorial />
    </>
  );
}
