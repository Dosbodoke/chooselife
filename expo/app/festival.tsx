import {
  useFestivalSchedule,
  type FestivalHighlineScheduleCard,
} from '@chooselife/ui';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  View,
} from 'react-native';

import { useOnlineStatus } from '~/context/react-query';

import { FestivalHighlineCardView } from '~/components/festival/highline-card';
import { FestivalScheduleSheet } from '~/components/festival/schedule-sheet';
import { SafeAreaOfflineView } from '~/components/offline-banner';
import { Text } from '~/components/ui/text';

const FESTIVAL_SLUG = 'chooselife-2026';

export default function FestivalScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const isOnline = useOnlineStatus();
  const { day: rawSelectedDayKey, highline: rawSelectedHighlineId } =
    useLocalSearchParams<{
      day?: string | string[];
      highline?: string | string[];
    }>();
  const query = useFestivalSchedule({ festivalSlug: FESTIVAL_SLUG });
  const isOffline = !isOnline;
  const selectedHighlineId = Array.isArray(rawSelectedHighlineId)
    ? (rawSelectedHighlineId[0] ?? null)
    : (rawSelectedHighlineId ?? null);
  const selectedDayKey = Array.isArray(rawSelectedDayKey)
    ? (rawSelectedDayKey[0] ?? null)
    : (rawSelectedDayKey ?? null);

  const cards = React.useMemo(
    () => query.data?.sectors.flatMap((sector) => sector.cards) ?? [],
    [query.data?.sectors],
  );

  const selectedCard = React.useMemo<FestivalHighlineScheduleCard | null>(
    () => cards.find((card) => card.highline.id === selectedHighlineId) ?? null,
    [cards, selectedHighlineId],
  );

  const handleOpenSchedule = React.useCallback(
    (card: FestivalHighlineScheduleCard) => {
      router.setParams({
        highline: card.highline.id,
        day: card.defaultDayKey,
      });
    },
    [router],
  );

  const handleDismissSchedule = React.useCallback(() => {
    router.setParams({
      highline: undefined,
      day: undefined,
    });
  }, [router]);

  const handleSelectDayKey = React.useCallback(
    (dayKey: string) => {
      if (!selectedHighlineId) return;

      router.setParams({
        highline: selectedHighlineId,
        day: dayKey,
      });
    },
    [router, selectedHighlineId],
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
          {query.isPending && !query.data ? (
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
                        onPress={() => handleOpenSchedule(card)}
                      />
                    ))}
                  </View>
                </View>
              ))}
            </View>
          ) : query.error ? (
            <View className="rounded-[28px] bg-white px-6 py-12">
              <Text className="text-center text-base leading-7 text-slate-500">
                {isOffline
                  ? t('app.(festival).highlines.offlineCacheEmpty')
                  : t('app.(festival).highlines.genericError')}
              </Text>
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
          onDismiss={handleDismissSchedule}
          onSelectDayKey={handleSelectDayKey}
          selectedDayKey={selectedDayKey}
        />
      </SafeAreaOfflineView>
    </>
  );
}
