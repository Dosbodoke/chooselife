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
const DEFAULT_FESTIVAL_TIME_ZONE = 'America/Sao_Paulo';

type FestivalScheduleQuery = ReturnType<typeof useFestivalSchedule>;
type FestivalScheduleData = NonNullable<FestivalScheduleQuery['data']>;
type FestivalSectorGroup = FestivalScheduleData['sectors'][number];

export default function FestivalScreen() {
  const router = useRouter();
  const isOnline = useOnlineStatus();

  const { day: rawSelectedDayKey, highline: rawSelectedHighlineId } =
    useLocalSearchParams<{
      day?: string | string[];
      highline?: string | string[];
    }>();

  const query = useFestivalSchedule({ festivalSlug: FESTIVAL_SLUG });

  const isOffline = !isOnline;
  const selectedHighlineId = getSingleSearchParam(rawSelectedHighlineId);
  const selectedDayKey = getSingleSearchParam(rawSelectedDayKey);
  const festivalTimeZone = getFestivalTimeZone(query.data);
  const title = query.data?.festival.name;

  const cards = React.useMemo(() => {
    if (!query.data?.sectors) {
      return [];
    }

    return query.data.sectors.flatMap((sector) => sector.cards);
  }, [query.data?.sectors]);

  const selectedCard =
    React.useMemo<FestivalHighlineScheduleCard | null>(() => {
      const card = cards.find(
        (item) => item.highline.id === selectedHighlineId,
      );

      if (!card) {
        return null;
      }

      return card;
    }, [cards, selectedHighlineId]);

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
      if (!selectedHighlineId) {
        return;
      }

      router.setParams({
        highline: selectedHighlineId,
        day: dayKey,
      });
    },
    [router, selectedHighlineId],
  );

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
          <FestivalContent
            query={query}
            isOffline={isOffline}
            festivalTimeZone={festivalTimeZone}
            onOpenSchedule={handleOpenSchedule}
          />
        </ScrollView>

        <FestivalScheduleSheet
          canManage={query.data?.viewer.canManage || false}
          card={selectedCard}
          festivalSlug={FESTIVAL_SLUG}
          festivalTimeZone={festivalTimeZone}
          onDismiss={handleDismissSchedule}
          onSelectDayKey={handleSelectDayKey}
          selectedDayKey={selectedDayKey}
        />
      </SafeAreaOfflineView>
    </>
  );
}

function getSingleSearchParam(value?: string | string[]) {
  if (Array.isArray(value)) {
    return value[0] || null;
  }

  return value || null;
}

function getFestivalTimeZone(data?: FestivalScheduleQuery['data']) {
  if (data?.festival.timezone) {
    return data.festival.timezone;
  }

  return DEFAULT_FESTIVAL_TIME_ZONE;
}

function getSectorKey(group: FestivalSectorGroup) {
  if (group.sector?.id) {
    return group.sector.id;
  }

  return 'festival';
}

function getSectorName(group: FestivalSectorGroup, fallbackLabel: string) {
  if (group.sector?.name) {
    return group.sector.name;
  }

  return fallbackLabel;
}

function LoadingState() {
  const { t } = useTranslation();

  return (
    <View className="items-center gap-4 rounded-[28px] bg-white px-6 py-12">
      <ActivityIndicator size="large" color="#0f172a" />
      <Text className="text-base text-slate-500">
        {t('app.(festival).highlines.loading')}
      </Text>
    </View>
  );
}

function EmptyState() {
  const { t } = useTranslation();

  return (
    <View className="rounded-[28px] bg-white px-6 py-12">
      <Text className="text-center text-base leading-7 text-slate-500">
        {t('app.(festival).highlines.empty')}
      </Text>
    </View>
  );
}

function ErrorState({ isOffline }: { isOffline: boolean }) {
  const { t } = useTranslation();

  const message = React.useMemo(() => {
    if (isOffline) {
      return t('app.(festival).highlines.offlineCacheEmpty');
    }

    return t('app.(festival).highlines.genericError');
  }, [isOffline, t]);

  return (
    <View className="rounded-[28px] bg-white px-6 py-12">
      <Text className="text-center text-base leading-7 text-slate-500">
        {message}
      </Text>
    </View>
  );
}

function SectorDescription({ description }: { description?: string | null }) {
  if (!description) {
    return null;
  }

  return (
    <Text className="text-sm leading-6 text-slate-500">{description}</Text>
  );
}

function SectorHeader({ group }: { group: FestivalSectorGroup }) {
  const { t } = useTranslation();

  return (
    <View className="gap-1">
      <Text className="text-2xl font-bold text-slate-950">
        {getSectorName(group, t('app.(festival).highlines.sectorFallback'))}
      </Text>

      <SectorDescription description={group.sector?.description} />
    </View>
  );
}

function FestivalHighlineCardList({
  cards,
  festivalTimeZone,
  onOpenSchedule,
}: {
  cards: FestivalHighlineScheduleCard[];
  festivalTimeZone: string;
  onOpenSchedule: (card: FestivalHighlineScheduleCard) => void;
}) {
  return (
    <View className="gap-5">
      {cards.map((card) => (
        <FestivalHighlineCardView
          key={card.highline.id}
          card={card}
          festivalTimeZone={festivalTimeZone}
          onPress={() => onOpenSchedule(card)}
        />
      ))}
    </View>
  );
}

function FestivalSector({
  group,
  festivalTimeZone,
  onOpenSchedule,
}: {
  group: FestivalSectorGroup;
  festivalTimeZone: string;
  onOpenSchedule: (card: FestivalHighlineScheduleCard) => void;
}) {
  return (
    <View className="gap-4">
      <SectorHeader group={group} />

      <FestivalHighlineCardList
        cards={group.cards}
        festivalTimeZone={festivalTimeZone}
        onOpenSchedule={onOpenSchedule}
      />
    </View>
  );
}

function FestivalSectorList({
  sectors,
  festivalTimeZone,
  onOpenSchedule,
}: {
  sectors: FestivalSectorGroup[];
  festivalTimeZone: string;
  onOpenSchedule: (card: FestivalHighlineScheduleCard) => void;
}) {
  return (
    <View className="gap-8">
      {sectors.map((group) => (
        <FestivalSector
          key={getSectorKey(group)}
          group={group}
          festivalTimeZone={festivalTimeZone}
          onOpenSchedule={onOpenSchedule}
        />
      ))}
    </View>
  );
}

function FestivalContent({
  query,
  isOffline,
  festivalTimeZone,
  onOpenSchedule,
}: {
  query: FestivalScheduleQuery;
  isOffline: boolean;
  festivalTimeZone: string;
  onOpenSchedule: (card: FestivalHighlineScheduleCard) => void;
}) {
  if (query.isPending && !query.data) {
    return <LoadingState />;
  }

  if (query.data?.sectors.length) {
    return (
      <FestivalSectorList
        sectors={query.data.sectors}
        festivalTimeZone={festivalTimeZone}
        onOpenSchedule={onOpenSchedule}
      />
    );
  }

  if (query.error) {
    return <ErrorState isOffline={isOffline} />;
  }

  return <EmptyState />;
}
