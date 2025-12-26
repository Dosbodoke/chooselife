import { Stack } from 'expo-router';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';
import Animated, { LinearTransition } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useI18n } from '~/context/i18n';
import { useEvents } from '~/hooks/use-events';

import { EventCard, EventCardSkeleton } from '~/components/event-card';
import { Text } from '~/components/ui/text';

const DAMPING = 80;
export const _layoutAnimation = LinearTransition.springify().damping(DAMPING);

export default function EventsPage() {
  const { t } = useTranslation();
  const { locale } = useI18n();
  const { eventsByMonth, query } = useEvents();

  const monthKeys = !query.isLoading ? Object.keys(eventsByMonth || {}) : [];

  return (
    <>
      <Stack.Screen options={{ title: t('app.events.title') }} />
      <SafeAreaView className="flex-1 pt-6" edges={["left", "right", "bottom"]}>
        <ScrollView>
          <View className="p-4">
            {/* --- Loading State --- */}
            {query.isPending ? (
              <View className="gap-4">
                <EventCardSkeleton />
                <EventCardSkeleton />
                <EventCardSkeleton />
              </View>
            ) : /* --- No Events State --- */
            monthKeys.length === 0 ? (
              <Text className="text-center text-muted-foreground">
                {t('app.events.noEvents')}
              </Text>
            ) : (
              /* --- Loaded State --- */
              monthKeys.map((monthKey) => (
                <View key={monthKey} className="mb-6">
                  <Animated.Text
                    layout={_layoutAnimation}
                    className="text-xl font-semibold mb-3 text-foreground px-1"
                  >
                    {monthKey
                      ? `${new Date(monthKey).toLocaleString(locale, { month: 'long' })} ${new Date(monthKey).getFullYear()}`
                      : ''}
                  </Animated.Text>
                  <View className="gap-4">
                    {(eventsByMonth?.[monthKey] ?? []).map((e) => (
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
