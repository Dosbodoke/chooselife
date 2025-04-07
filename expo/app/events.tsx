import { Stack } from 'expo-router';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { SafeAreaView, ScrollView, View } from 'react-native';
import Animated, { LinearTransition } from 'react-native-reanimated';

import { useI18n } from '~/context/i18n';
import { useEvents } from '~/hooks/use-events';

import { EventCard } from '~/components/event-card';
import { Text } from '~/components/ui/text';

const DAMPING = 80;
export const _layoutAnimation = LinearTransition.springify().damping(DAMPING);

export default function EventsPage() {
  const { t } = useTranslation();
  const { locale } = useI18n();
  const { eventsByMonth, query } = useEvents();

  console.log({ eventsByMonth });
  // Get the keys (month strings like "April 2025") from eventsByMonth
  // Handle the case where eventsByMonth might be initially empty or undefined
  const monthKeys = Object.keys(eventsByMonth || {});

  return (
    <>
      <Stack.Screen options={{ title: t('app.events.title') }} />
      <SafeAreaView className="flex-1 pt-6">
        <ScrollView>
          <View className="p-4">
            {monthKeys.length === 0 && !query.isLoading ? (
              <Text className="text-center text-gray-500">
                {t('app.events.noEvents')}
              </Text>
            ) : (
              monthKeys.map((monthKey) => (
                <View key={monthKey} className="mb-6">
                  <Animated.Text
                    layout={_layoutAnimation}
                    className="text-xl font-semibold mb-3 text-slate-800 px-1"
                  >
                    {`${new Date(monthKey).toLocaleString(locale, { month: 'long' })} ${new Date(monthKey).getFullYear()}`}
                  </Animated.Text>
                  <View className="gap-4">
                    {eventsByMonth[monthKey].map((e) => (
                      <EventCard key={e.id} event={e} />
                    ))}
                  </View>
                </View>
              ))
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    </>
  );
}
