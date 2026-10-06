import { weatherKeyFactory } from '@chooselife/ui';
import { useNetInfo } from '@react-native-community/netinfo';
import { useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { FootprintsIcon } from 'lucide-react-native';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import Animated, {
  useAnimatedRef,
  useSharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { highlineKeyFactory, useHighline } from '~/hooks/use-highline';
import { useShare } from '~/hooks/use-share';

import {
  COVER_HEIGHT,
  HighlineCover,
  PullToRefreshRing,
  SHEET_OVERLAP,
  usePullToRefresh,
} from '~/components/highline/highline-cover';
import {
  HEADER_BUTTON_SIZE,
  HighlineHeader,
} from '~/components/highline/highline-header';
import {
  HIGHLINE_TABS_BAR_HEIGHT,
  HighlineTabContent,
  HighlineTabsBar,
  PinnedHighlineTabsBar,
  useHighlineTabsPinned,
  type HighlineTab,
} from '~/components/highline/highline-tabs';
import { HighlineDetails, HighlineSummary } from '~/components/highline/info';
import { HighlineNotFound } from '~/components/highline/not-found';
import { RigModal } from '~/components/highline/rig-confirmations';
import { HighlineSkeleton } from '~/components/highline/skeleton';
import { OfflineBanner } from '~/components/offline-banner';
import { Ranking } from '~/components/ranking';
import { FAB } from '~/components/ui/fab';

export default function HighlinePage() {
  const { t } = useTranslation();
  const { isConnected } = useNetInfo();
  const { id: highlineID, setupID } = useLocalSearchParams<{
    id: string;
    setupID?: string;
  }>();
  const [tab, setTab] = useState<HighlineTab>('details');

  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { highline, isPending } = useHighline({ id: highlineID });
  const { share } = useShare();
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);

  // Refetch only what this page shows: everything keyed under the highline,
  // its weather, and leaderboards that include it.
  const refresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        queryClient.refetchQueries({
          queryKey: highlineKeyFactory.detail(highlineID).slice(0, 2),
        }),
        highline?.anchor_a_lat && highline.anchor_a_long
          ? queryClient.refetchQueries({
              queryKey: weatherKeyFactory.current(
                highline.anchor_a_lat,
                highline.anchor_a_long,
              ),
            })
          : undefined,
        queryClient.refetchQueries({
          predicate: ({ queryKey }) =>
            queryKey[0] === 'leaderboard' &&
            (
              queryKey[1] as { highlinesID?: string[] } | undefined
            )?.highlinesID?.includes(highlineID) === true,
        }),
      ]);
    } catch (error) {
      console.error('Failed to refresh highline:', error);
    }
    setRefreshing(false);
  };

  const { scrollY, scrollHandler, refreshControl } = usePullToRefresh({
    refreshing,
    onRefresh: refresh,
  });

  // The offline banner covers the status bar, so push the actions below it.
  const headerTop = isConnected ? insets.top + 8 : insets.top * 2;
  const headerBarHeight = headerTop + HEADER_BUTTON_SIZE + 12;
  const collapseAt = COVER_HEIGHT - SHEET_OVERLAP - headerBarHeight;

  // Tabs pin under the header once their inline bar scrolls up to it.
  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  const tabsBarY = useSharedValue(0);
  const { pinned: tabsPinned, isPinned: tabsIsPinned } = useHighlineTabsPinned(
    scrollY,
    tabsBarY,
    headerBarHeight,
  );

  const changeTab = (next: HighlineTab) => {
    if (next === tab) return;
    Haptics.selectionAsync();
    // While pinned, start the new tab at its top instead of mid-way down.
    const pinnedAt = tabsBarY.get() - headerBarHeight;
    if (scrollY.get() > pinnedAt) {
      scrollRef.current?.scrollTo({ y: pinnedAt, animated: false });
    }
    setTab(next);
  };

  const shareListing = async () => {
    if (!highline) return;
    const url = `${process.env.EXPO_PUBLIC_WEB_URL}/highline/${highline.id}`;
    await share({
      title: highline.name,
      url,
      type: 'highline',
    });
  };

  // Room under the content so the FAB never covers it
  const fabClearance = insets.bottom + 100;

  if (isPending) {
    return <HighlineSkeleton />;
  }

  if (!highline) {
    return <HighlineNotFound />;
  }

  return (
    <>
      <View className="flex-1 bg-gray-100">
        <HighlineCover coverImageId={highline.cover_image} scrollY={scrollY} />

        <Animated.ScrollView
          ref={scrollRef}
          onScroll={scrollHandler}
          scrollEventThrottle={16}
          refreshControl={refreshControl}
        >
          <View style={{ height: COVER_HEIGHT - SHEET_OVERLAP }} />
          {/* Content sheet over the cover */}
          <View className="bg-gray-100 rounded-t-3xl px-4 pt-6 gap-6 flex-1 min-h-screen">
            <HighlineSummary highline={highline} />
            <HighlineTabsBar
              tab={tab}
              onTabChange={changeTab}
              offsetY={COVER_HEIGHT - SHEET_OVERLAP}
              barY={tabsBarY}
              pinned={tabsPinned}
            />
            <HighlineTabContent tab={tab} onTabChange={changeTab}>
              {tab === 'details' ? (
                <HighlineDetails highline={highline} />
              ) : (
                <Ranking highlines_ids={[highline.id]} />
              )}
            </HighlineTabContent>
            {/* A spacer rather than contentContainerStyle padding: padding
                changes re-lay out the whole list, and contentInset is iOS-only. */}
            <View style={{ height: fabClearance }} />
          </View>
        </Animated.ScrollView>

        <View pointerEvents="none" className="absolute top-0 left-0 right-0">
          <OfflineBanner />
        </View>

        <HighlineHeader
          highline={highline}
          scrollY={scrollY}
          collapseAt={collapseAt}
          paddingTop={headerTop}
          onBack={() =>
            router.canGoBack() ? router.back() : router.replace('/(tabs)')
          }
          onShare={shareListing}
          blurExtension={tabsIsPinned ? HIGHLINE_TABS_BAR_HEIGHT : 0}
        />

        <PinnedHighlineTabsBar
          top={headerBarHeight}
          tab={tab}
          onTabChange={changeTab}
          pinned={tabsPinned}
          isPinned={tabsIsPinned}
        />

        <PullToRefreshRing
          scrollY={scrollY}
          refreshing={refreshing}
          top={headerBarHeight}
        />
      </View>

      {/* Floating Action Button - Register Walk */}
      <FAB
        icon={FootprintsIcon}
        label={t('app.highline.index.BottomActions.register')}
        href={`/highline/${highlineID}/register`}
      />

      <RigModal highlineID={highlineID} setupID={setupID} />
    </>
  );
}
