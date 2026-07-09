import {
  getViewerFestivalBookings,
  useFestivalSchedule,
  type FestivalHighlineScheduleCard,
} from '@chooselife/ui';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Share as ShareIcon } from 'lucide-react-native';
import React from 'react';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';

import { useOnlineStatus } from '~/context/react-query';
import { useShare } from '~/hooks/use-share';

import { FestivalBookingReminderSync } from '~/components/festival/festival-booking-reminder-sync';
import { FestivalSyncStatus } from '~/components/festival/festival-sync-status';
import {
  FestivalEmptyState,
  FestivalErrorState,
  FestivalLoadingState,
  FestivalSectorList,
  ViewerScheduleSummary,
} from '~/components/festival/highline-card';
import { FestivalScheduleSheet } from '~/components/festival/schedule-sheet';
import { SafeAreaOfflineView } from '~/components/offline-banner';
import { Icon } from '~/components/ui/icon';

const DEFAULT_FESTIVAL_TIME_ZONE = 'America/Sao_Paulo';

type FestivalScheduleQuery = ReturnType<typeof useFestivalSchedule>;

export default function FestivalScreen() {
  const router = useRouter();
  const isOnline = useOnlineStatus();
  const { share } = useShare();

  const {
    slug: rawSlug,
    day: rawSelectedDayKey,
    highline: rawSelectedHighlineId,
  } = useLocalSearchParams<{
    slug: string | string[];
    day?: string | string[];
    highline?: string | string[];
  }>();

  const festivalSlug = getSingleSearchParam(rawSlug) ?? '';

  const query = useFestivalSchedule({ festivalSlug });

  const selectedHighlineId = getSingleSearchParam(rawSelectedHighlineId);
  const selectedDayKey = getSingleSearchParam(rawSelectedDayKey);
  const festivalTimeZone = getFestivalTimeZone(query.data);
  const title = query.data?.festival.name ?? '';

  const cards = query.data?.sectors.flatMap((sector) => sector.cards) ?? [];
  const selectedCard =
    cards.find((item) => item.highline.id === selectedHighlineId) ?? null;

  const handleOpenSchedule = React.useCallback(
    (card: FestivalHighlineScheduleCard, dayKey?: string | null) => {
      router.setParams({
        highline: card.highline.id,
        day: dayKey ?? card.defaultDayKey,
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

  const handleShareFestival = React.useCallback(async () => {
    const url = `${process.env.EXPO_PUBLIC_WEB_URL}/festival/${festivalSlug}`;

    await share({
      title,
      url,
    });
  }, [share, title, festivalSlug]);

  return (
    <>
      <Stack.Screen
        options={{
          title,
          headerRight: ({ tintColor }) => (
            <Pressable
              onPress={handleShareFestival}
              hitSlop={20}
              className="p-2"
              style={{ alignItems: 'center', justifyContent: 'center' }}
            >
              <Icon as={ShareIcon} color={tintColor ?? '#000'} size={24} />
            </Pressable>
          ),
        }}
      />

      <SafeAreaOfflineView
        className="flex-1 bg-gray-100"
        edges={['left', 'right']}
        offlineBannerCoversStatusBar={false}
      >
        <ScrollView
          className="flex-1"
          contentContainerClassName="gap-8 pb-10 pt-6"
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
            isOffline={!isOnline}
            festivalTimeZone={festivalTimeZone}
            onOpenSchedule={handleOpenSchedule}
          />
        </ScrollView>

        <FestivalScheduleSheet
          bookingCooldownEndsAt={query.data?.bookingCooldownEndsAt}
          bookingLimit={query.data?.bookingLimit ?? null}
          canManage={query.data?.viewer.canManage || false}
          card={selectedCard}
          festivalSlug={festivalSlug}
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

function FestivalContent({
  query,
  isOffline,
  festivalTimeZone,
  onOpenSchedule,
}: {
  query: FestivalScheduleQuery;
  isOffline: boolean;
  festivalTimeZone: string;
  onOpenSchedule: (
    card: FestivalHighlineScheduleCard,
    dayKey?: string | null,
  ) => void;
}) {
  let content: React.ReactNode;
  const viewerBookings = query.data?.sectors.length
    ? getViewerFestivalBookings(query.data.sectors)
    : [];

  if (query.isPending && !query.data) {
    content = <FestivalLoadingState />;
  } else if (query.data?.sectors.length) {
    content = (
      <View className="gap-8">
        <FestivalBookingReminderSync
          bookings={viewerBookings}
          festivalTimeZone={festivalTimeZone}
        />

        <ViewerScheduleSummary
          bookingLimit={query.data.bookingLimit}
          bookings={viewerBookings}
          festivalTimeZone={festivalTimeZone}
          hasAccount={!!query.data.viewer.userId}
          isOffline={isOffline}
          onOpenSchedule={onOpenSchedule}
        />

        <FestivalSectorList
          sectors={query.data.sectors}
          festivalTimeZone={festivalTimeZone}
          onOpenSchedule={onOpenSchedule}
        />
      </View>
    );
  } else if (query.error) {
    content = <FestivalErrorState isOffline={isOffline} />;
  } else {
    content = <FestivalEmptyState />;
  }

  return (
    <View className="gap-4">
      <FestivalSyncStatus
        isFetching={query.isFetching}
        isOffline={isOffline}
        timeZone={festivalTimeZone}
        updatedAt={query.dataUpdatedAt}
      />

      {content}
    </View>
  );
}
