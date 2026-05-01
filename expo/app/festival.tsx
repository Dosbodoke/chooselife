import {
  useFestivalSchedule,
  type FestivalHighlineScheduleCard,
} from '@chooselife/ui';
import { Stack } from 'expo-router';
import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  View,
} from 'react-native';

import { FestivalHighlineCardView } from '~/components/festival/highline-card';
import { FestivalScheduleSheet } from '~/components/festival/schedule-sheet';
import { SafeAreaOfflineView } from '~/components/offline-banner';
import { Text } from '~/components/ui/text';

const FESTIVAL_SLUG = 'chooselife-2026';

export default function FestivalScreen() {
  const { t } = useTranslation();
  const query = useFestivalSchedule({ festivalSlug: FESTIVAL_SLUG });
  const [selectedHighlineId, setSelectedHighlineId] = React.useState<
    string | null
  >(null);

  const cards = React.useMemo(
    () => query.data?.sectors.flatMap((sector) => sector.cards) ?? [],
    [query.data?.sectors],
  );

  const selectedCard = React.useMemo<FestivalHighlineScheduleCard | null>(
    () => cards.find((card) => card.highline.id === selectedHighlineId) ?? null,
    [cards, selectedHighlineId],
  );

  const title = query.data?.festival.name;

  return (
    <>
      <Stack.Screen options={{ title }} />

      <SafeAreaOfflineView
        className="flex-1 bg-gray-100"
        edges={['left', 'right']}
      >
        <ScrollView
          className="flex-1"
          contentContainerClassName="gap-8 px-4 pb-10 pt-6"
          refreshControl={
            <RefreshControl
              onRefresh={() => {
                void query.refetch();
              }}
              refreshing={query.isRefetching}
            />
          }
        >
          {query.isPending ? (
            <View className="items-center gap-4 rounded-[28px] bg-white px-6 py-12">
              <ActivityIndicator size="large" color="#0f172a" />
              <Text className="text-base text-slate-500">
                {t('app.(festival).highlines.loading')}
              </Text>
            </View>
          ) : query.data?.sectors.length ? (
            <View className="gap-8">
              {query.data.sectors.map((group) => (
                <View key={group.sector?.id ?? 'festival'} className="gap-4">
                  <View className="gap-1">
                    <Text className="text-2xl font-bold text-slate-950">
                      {group.sector?.name ??
                        t('app.(festival).highlines.sectorFallback')}
                    </Text>
                    {group.sector?.description ? (
                      <Text className="text-sm leading-6 text-slate-500">
                        {group.sector.description}
                      </Text>
                    ) : null}
                  </View>

                  <View className="gap-5">
                    {group.cards.map((card) => (
                      <FestivalHighlineCardView
                        key={card.highline.id}
                        card={card}
                        festivalTimeZone={query.data?.festival.timezone ?? 'America/Sao_Paulo'}
                        onPress={() => setSelectedHighlineId(card.highline.id)}
                      />
                    ))}
                  </View>
                </View>
              ))}
            </View>
          ) : (
            <View className="rounded-[28px] bg-white px-6 py-12">
              <Text className="text-center text-base leading-7 text-slate-500">
                {t('app.(festival).highlines.empty')}
              </Text>
            </View>
          )}
        </ScrollView>

        <FestivalScheduleSheet
          canManage={query.data?.viewer.canManage ?? false}
          card={selectedCard}
          festivalSlug={FESTIVAL_SLUG}
          festivalTimeZone={query.data?.festival.timezone ?? 'America/Sao_Paulo'}
          onDismiss={() => setSelectedHighlineId(null)}
        />
      </SafeAreaOfflineView>
    </>
  );
}
