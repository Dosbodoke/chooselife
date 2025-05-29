import BottomSheet, {
  BottomSheetBackdrop,
  BottomSheetBackdropProps,
  BottomSheetView,
} from '@gorhom/bottom-sheet';
import * as Notifications from 'expo-notifications';
import AsyncStorage from 'expo-sqlite/kv-store';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  View,
} from 'react-native';
import { LinearTransition } from 'react-native-reanimated';

import { useI18n } from '~/context/i18n';
import { cn } from '~/lib/utils';
import { scheduleData, TScheduleData } from '~/utils/festival-data';

import { Card, CardContent } from '~/components/ui/card';
import { Text } from '~/components/ui/text';

const dayTabs = [
  { id: 'all', label: 'Todos' },
  { id: '2025-06-19', label: 'Quinta' },
  { id: '2025-06-20', label: 'Sexta' },
  { id: '2025-06-21', label: 'Sábado' },
  { id: '2025-06-22', label: 'Domingo' },
] as const;

const typeTabs = [
  { id: 'workshop', label: 'Workshops', icon: '🎯' },
  { id: 'competition', label: 'Competições', icon: '🏆' },
] as const;

const DAMPING = 80;
export const _layoutAnimation = LinearTransition.springify().damping(DAMPING);

// AsyncStorage keys
const FAVORITES_STORAGE_KEY = '@event_favorites';
const TUTORIAL_SHOWN_KEY = '@tutorial_shown';

// Helper function to format date display
const formatDateDisplay = (dateString: string) => {
  const dateMap: Record<string, string> = {
    '2025-06-19': 'Quinta-feira, 19 de Junho',
    '2025-06-20': 'Sexta-feira, 20 de Junho',
    '2025-06-21': 'Sábado, 21 de Junho',
    '2025-06-22': 'Domingo, 22 de Junho',
  };
  return dateMap[dateString] || dateString;
};

// Helper function to get current day or 'all' if not available
const getCurrentDay = () => {
  const today = new Date();
  const currentDateString = today.toISOString().split('T')[0]; // Format: YYYY-MM-DD

  // Check if current date exists in our event days
  const availableDays = [
    '2025-06-19',
    '2025-06-20',
    '2025-06-21',
    '2025-06-22',
  ];
  return availableDays.includes(currentDateString) ? currentDateString : 'all';
};

// Helper function to parse event time and create notification date
const getNotificationDate = (eventDay: string, startTime: string) => {
  const [year, month, day] = eventDay.split('-').map(Number);
  const timeMatch = startTime.match(/(\d{1,2}):(\d{2})/);

  if (!timeMatch) return null;

  const [, hours, minutes] = timeMatch;
  const eventDate = new Date(
    year,
    month - 1,
    day,
    parseInt(hours),
    parseInt(minutes),
  );

  // Subtract 1 hour for notification
  const notificationDate = new Date(eventDate.getTime() - 60 * 60 * 1000);

  // Don't schedule notifications for past events
  if (notificationDate < new Date()) return null;

  return notificationDate;
};

export default function EventsPage() {
  const [activeDay, setActiveDay] = useState<string>(getCurrentDay());
  const [activeType, setActiveType] = useState<
    (typeof typeTabs)[number]['id'] | null
  >(null);
  const [favorites, setFavorites] = useState<Set<number>>(new Set());
  const [isLoading, setIsLoading] = useState(true);

  const { t } = useTranslation();
  const { locale } = useI18n();

  // Load favorites from AsyncStorage on component mount
  useEffect(() => {
    loadFavorites();
  }, []);

  const loadFavorites = async () => {
    try {
      const storedFavorites = await AsyncStorage.getItem(FAVORITES_STORAGE_KEY);
      if (storedFavorites) {
        const favoritesArray = JSON.parse(storedFavorites);
        setFavorites(new Set(favoritesArray));
      }
    } catch (error) {
      console.error('Error loading favorites:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const saveFavorites = async (newFavorites: Set<number>) => {
    try {
      const favoritesArray = Array.from(newFavorites);
      await AsyncStorage.setItem(
        FAVORITES_STORAGE_KEY,
        JSON.stringify(favoritesArray),
      );
    } catch (error) {
      console.error('Error saving favorites:', error);
    }
  };

  const toggleFavorite = async (eventId: number, eventData: TScheduleData) => {
    const newFavorites = new Set(favorites);

    if (favorites.has(eventId)) {
      // Remove from favorites and cancel notification
      newFavorites.delete(eventId);
      await Notifications.cancelScheduledNotificationAsync(eventId.toString());
    } else {
      // Add to favorites and schedule notification
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
              title: 'Evento em breve! ⭐',
              body: `${eventData.title} começará às ${eventData.startAt}${eventData.location ? ` em ${eventData.location}` : ''}`,
            },
            trigger: {
              type: Notifications.SchedulableTriggerInputTypes.DATE,
              date: notificationDate,
            },
          });

          Alert.alert(
            'Adicionado aos Favoritos! ⭐',
            `Você receberá uma notificação 1 hora antes de "${eventData.title}" começar.`,
            [{ text: 'Choose Life' }],
          );
        }
      }
    }

    setFavorites(newFavorites);
    await saveFavorites(newFavorites);
  };

  const filteredData = scheduleData.filter((item) => {
    const dayMatch = activeDay === 'all' || item.day === activeDay;
    const typeMatch = activeType === null || item.type === activeType;
    return dayMatch && typeMatch;
  });

  // Group filtered data by day for better organization
  const groupedByDay = filteredData.reduce(
    (acc, item) => {
      const day = item.day || 'no-date';
      if (!acc[day]) {
        acc[day] = [];
      }
      acc[day].push(item);
      return acc;
    },
    {} as Record<string, TScheduleData[]>,
  );

  // Sort the days
  const sortedDays = Object.keys(groupedByDay).sort();

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center">
        <Text className="text-lg text-gray-600">Carregando eventos...</Text>
      </SafeAreaView>
    );
  }

  return (
    <>
      <SafeAreaView className="flex-1 pt-6">
        <ScrollView>
          {/* Day Filter Tabs */}
          <View className="px-4 mb-4">
            <Text className="text-lg font-semibold mb-3 text-gray-900">
              Dias do Evento
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View className="flex-row gap-2">
                {dayTabs.map((tab) => (
                  <TouchableOpacity
                    key={tab.id}
                    onPress={() => setActiveDay(tab.id)}
                    className={cn(
                      'flex-row items-center px-4 py-2 rounded-full border',
                      activeDay === tab.id
                        ? 'bg-blue-100 border-blue-300'
                        : 'bg-white border-gray-300',
                    )}
                  >
                    <Text className="text-sm mr-1">📅</Text>
                    <Text
                      className={cn(
                        'text-sm font-medium',
                        activeDay === tab.id
                          ? 'text-blue-800'
                          : 'text-gray-600',
                      )}
                    >
                      {tab.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </View>

          {/* Type Filter Tabs */}
          <View className="px-4 mb-4">
            <Text className="text-lg font-semibold mb-3 text-gray-900">
              Tipo de Atividade
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View className="flex-row gap-2">
                {typeTabs.map((tab) => (
                  <TouchableOpacity
                    key={tab.id}
                    onPress={() =>
                      setActiveType(activeType === tab.id ? null : tab.id)
                    }
                    className={cn(
                      'flex-row items-center px-4 py-2 rounded-full border',
                      activeType === tab.id
                        ? 'bg-green-100 border-green-300'
                        : 'bg-white border-gray-300',
                    )}
                  >
                    <Text className="text-sm mr-1">{tab.icon}</Text>
                    <Text
                      className={cn(
                        'text-sm font-medium',
                        activeType === tab.id
                          ? 'text-green-800'
                          : 'text-gray-600',
                      )}
                    >
                      {tab.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </View>

          {/* Events grouped by day */}
          <View className="px-4 gap-6">
            {activeDay === 'all' ? (
              // Show all days with headers
              sortedDays.map((day) => (
                <View key={day}>
                  <View className="mb-4">
                    <Text className="text-xl font-bold text-gray-900 mb-1">
                      {formatDateDisplay(day)}
                    </Text>
                    <View className="h-1 w-16 bg-blue-500 rounded-full" />
                  </View>
                  <View className="gap-4 mb-6">
                    {groupedByDay[day].map((data) => (
                      <ScheduleCard
                        key={data.id}
                        data={data}
                        isFavorite={favorites.has(data.id)}
                        onToggleFavorite={() => toggleFavorite(data.id, data)}
                      />
                    ))}
                  </View>
                </View>
              ))
            ) : (
              // Show only selected day
              <View className="gap-4">
                {filteredData.map((data) => (
                  <ScheduleCard
                    key={data.id}
                    data={data}
                    isFavorite={favorites.has(data.id)}
                    onToggleFavorite={() => toggleFavorite(data.id, data)}
                  />
                ))}
              </View>
            )}
          </View>
        </ScrollView>
      </SafeAreaView>

      {/* Tutorial Bottom Sheet */}
      <BottomSheetTutorial />
    </>
  );
}

export const ScheduleCard: React.FC<{
  data: TScheduleData;
  isFavorite: boolean;
  onToggleFavorite: () => void;
}> = ({ data, isFavorite, onToggleFavorite }) => {
  const getTypeColor = (type?: string) => {
    switch (type) {
      case 'workshop':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'competition':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getTypeIcon = (type?: string) => {
    switch (type) {
      case 'workshop':
        return '🎯';
      case 'competition':
        return '🏆';
      default:
        return '📅';
    }
  };

  return (
    <Card className="bg-white shadow-sm border border-gray-200">
      <CardContent className="p-3">
        {/* Header with time, type, and favorite button */}
        <View className="flex-row justify-between items-start mb-2">
          <View className="flex-row items-center flex-1">
            <View className="w-10 h-10 bg-blue-50 rounded-lg items-center justify-center mr-3">
              <Text className="text-base">{getTypeIcon(data.type)}</Text>
            </View>
            <View className="flex-1">
              <Text className="text-base font-bold text-blue-600">
                {data.startAt}
              </Text>
              <Text className="text-xs text-gray-500">Horário</Text>
            </View>
          </View>

          <View className="flex-row items-center gap-2">
            {/* Type Badge */}
            {data.type && (
              <View
                className={cn(
                  'px-2 py-1 rounded-full border',
                  getTypeColor(data.type),
                )}
              >
                <Text className="text-xs font-medium capitalize">
                  {data.type}
                </Text>
              </View>
            )}

            {/* Favorite Button */}
            <TouchableOpacity
              onPress={onToggleFavorite}
              className={cn(
                'w-10 h-10 rounded-full items-center justify-center',
                isFavorite
                  ? 'bg-amber-100 border-2 border-amber-300'
                  : 'bg-gray-100 border-2 border-gray-200',
              )}
            >
              <Text className="text-lg">{isFavorite ? '⭐' : '☆'}</Text>
            </TouchableOpacity>
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
              <Text className="text-sm text-gray-500">Instructor:</Text>
              <Text className="text-sm font-medium text-gray-700 flex-1">
                {data.instructor}
              </Text>
            </View>
          )}

          {data.location && (
            <View className="flex-row items-center gap-1">
              <Text className="text-sm text-gray-500">Local:</Text>
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

const BottomSheetTutorial: React.FC = () => {
  const bottomSheetRef = useRef<BottomSheet>(null);

  useEffect(() => {
    const checkAndShowTutorial = async () => {
      try {
        const tutorialShown = await AsyncStorage.getItem(TUTORIAL_SHOWN_KEY);
        if (!tutorialShown) {
          // Show tutorial after a small delay
          setTimeout(() => {
            bottomSheetRef.current?.expand();
          }, 1000);
        }
      } catch (error) {
        console.error('Error checking tutorial status:', error);
      }
    };

    checkAndShowTutorial();
  }, []);

  const markTutorialAsShown = async () => {
    try {
      await AsyncStorage.setItem(TUTORIAL_SHOWN_KEY, 'true');
    } catch (error) {
      console.error('Error marking tutorial as shown:', error);
    }
  };

  const handleCloseTutorial = useCallback(() => {
    bottomSheetRef.current?.close();
    markTutorialAsShown();
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
            A gente sabe que você é Choosado
          </Text>
          <Text className="text-sm text-gray-600 text-center">
            Use o APP para te ajudar a lembrar dos eventos.
          </Text>
        </View>

        <View className="gap-4 mb-6">
          <View className="flex-row items-start gap-3">
            <View className="w-8 h-8 bg-blue-100 rounded-full items-center justify-center mt-1">
              <Text className="text-base">⭐</Text>
            </View>
            <View className="flex-1">
              <Text className="font-semibold text-gray-900 mb-1">
                Marque como favorito
              </Text>
              <Text className="text-sm text-gray-600">
                Toque na estrela ao lado de qualquer evento para adicioná-lo aos
                seus favoritos.
              </Text>
            </View>
          </View>

          <View className="flex-row items-start gap-3">
            <View className="w-8 h-8 bg-green-100 rounded-full items-center justify-center mt-1">
              <Text className="text-base">🔔</Text>
            </View>
            <View className="flex-1">
              <Text className="font-semibold text-gray-900 mb-1">
                Receba notificações
              </Text>
              <Text className="text-sm text-gray-600">
                Você será notificado 1 hora antes do evento começar, para não
                perder nada!
              </Text>
            </View>
          </View>
        </View>

        <TouchableOpacity
          onPress={handleCloseTutorial}
          className="bg-blue-600 rounded-lg py-3 px-6 items-center"
        >
          <Text className="text-white font-semibold">Entendi!</Text>
        </TouchableOpacity>
      </BottomSheetView>
    </BottomSheet>
  );
};
