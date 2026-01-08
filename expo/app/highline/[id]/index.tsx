import { useNetInfo } from '@react-native-community/netinfo';
import { Link, useLocalSearchParams, useRouter } from 'expo-router';
import {
  ChevronLeftIcon,
  FootprintsIcon,
  PencilIcon,
  ShareIcon,
} from 'lucide-react-native';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ScrollView,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useHighline } from '~/hooks/use-highline';
import { useShare } from '~/hooks/use-share';

import { FavoriteHighline } from '~/components/highline/favorite-button';
import { HighlineImage } from '~/components/highline/highline-image';
import Info from '~/components/highline/info';
import { LocationWeatherCard } from '~/components/highline/location-weather-card';
import { HighlineNotFound } from '~/components/highline/not-found';
import { RigModal } from '~/components/highline/rig-confirmations';
import { HighlineSkeleton } from '~/components/highline/skeleton';
import { OfflineBanner } from '~/components/offline-banner';
import { Ranking } from '~/components/ranking';
import { FAB } from '~/components/ui/fab';
import { Icon } from '~/components/ui/icon';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '~/components/ui/tabs';
import { Text } from '~/components/ui/text';

type HighlineTabs = 'details' | 'ranking';

export default function HighlinePage() {
  const { t } = useTranslation();
  const { isConnected } = useNetInfo();
  const { id: highlineID, setupID } = useLocalSearchParams<{
    id: string;
    setupID?: string;
  }>();
  const [tab, setTab] = useState<HighlineTabs>('details');

  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { highline, isPending } = useHighline({ id: highlineID });
  const { share } = useShare();

  const shareListing = async () => {
    if (!highline) return;
    const url = `${process.env.EXPO_PUBLIC_WEB_URL}/highline/${highline.id}`;
    await share({
      title: highline.name,
      url,
      type: 'highline',
    });
  };

  const tabs = useMemo(
    () => [
      {
        id: 'details',
        label: t('app.highline.index.tabs.details'),
        content: <Info />,
      },
      {
        id: 'ranking',
        label: 'Ranking',
        content: <Ranking highlines_ids={[highline?.id || '']} />,
      },
    ],
    [highline?.id, t],
  );

  // Padding for FAB
  const paddingBottom = useMemo(
    () => insets.bottom + 100,
    [insets.bottom],
  );

  if (isPending) {
    return <HighlineSkeleton />;
  }

  if (!highline) {
    return <HighlineNotFound />;
  }

  return (
    <>
      <ScrollView
        className="bg-gray-100"
        contentContainerStyle={{
          paddingBottom,
        }}
      >
        <OfflineBanner />
        {/* Header Actions (overlay on image) */}
        <View
          className="absolute px-4 flex-row justify-between w-full top-0 z-50"
          style={{
            paddingTop: isConnected ? insets.top + 8 : insets.top * 2,
          }}
        >
          <TouchableOpacity
            className="p-2 rounded-full bg-black/60 items-center justify-center"
            onPress={() =>
              router.canGoBack() ? router.back() : router.replace('/(tabs)')
            }
          >
            <Icon as={ChevronLeftIcon} className="text-white size-6" />
          </TouchableOpacity>
          <View className="flex-row items-center justify-center gap-3">
            <Link href={`/highline/${highlineID}/edit`} asChild>
              <TouchableOpacity className="p-2 rounded-full bg-black/60 items-center justify-center">
                <Icon as={PencilIcon} className="text-white size-6" />
              </TouchableOpacity>
            </Link>
            <TouchableOpacity
              className="p-2 rounded-full bg-black/60 items-center justify-center"
              onPress={shareListing}
            >
              <Icon as={ShareIcon} className="text-white size-6" />
            </TouchableOpacity>
            <FavoriteHighline
              isFavorite={!!highline?.is_favorite}
              id={highline?.id}
            />
          </View>
        </View>

        {/* Cover Image */}
        <HighlineImage
          coverImageId={highline.cover_image}
          className="w-full h-80"
        />

        {/* Content */}
        <View className="px-4 pt-6 gap-6 flex-1">
          {/* Tabs */}
          <Tabs
            className="flex-1"
            value={tab}
            onValueChange={(val) => setTab(val as HighlineTabs)}
          >
            <TabsList className="flex-row bg-gray-200">
              {tabs.map((tabItem) => (
                <TabsTrigger
                  key={tabItem.id}
                  className="rounded-lg flex-1"
                  value={tabItem.id as HighlineTabs}
                >
                  <Text>{tabItem.label}</Text>
                </TabsTrigger>
              ))}
            </TabsList>
            {tabs.map((tabItem) => (
              <TabsContent
                key={tabItem.id}
                className="flex-1 mt-6"
                value={tabItem.id as HighlineTabs}
              >
                {tabItem.content}
              </TabsContent>
            ))}
          </Tabs>

          {/* Location & Weather Card */}
          {tab === 'details' && (
            <LocationWeatherCard
              hasLocation={!!highline.anchor_a_lat}
              latitude={highline.anchor_a_lat ?? undefined}
              longitude={highline.anchor_a_long ?? undefined}
            />
          )}
        </View>
      </ScrollView>

      {/* Floating Action Button - Register Walk */}
      {tab === 'details' && (
        <FAB
          icon={FootprintsIcon}
          label={t('app.highline.index.BottomActions.register')}
          href={`/highline/${highlineID}/register`}
        />
      )}

      <RigModal highlineID={highlineID} setupID={setupID} />
    </>
  );
}
