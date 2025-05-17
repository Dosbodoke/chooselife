import { useNetInfo } from '@react-native-community/netinfo';
import { Link, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ScrollView,
  Share,
  TouchableOpacity,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '~/context/auth';
import { useI18n } from '~/context/i18n';
import { useHighline } from '~/hooks/use-highline';
import { LucideIcon } from '~/lib/icons/lucide-icon';
import { MarkerCL } from '~/lib/icons/MarkerCL';

import { FavoriteHighline } from '~/components/highline/favorite-button';
import { HighlineImage } from '~/components/highline/highline-image';
import Info from '~/components/highline/info';
import { HighlineNotFound } from '~/components/highline/not-found';
import { RigModal } from '~/components/highline/rig-confirmations';
import { HighlineSkeleton } from '~/components/highline/skeleton';
import { OfflineBanner } from '~/components/offline-banner';
import { Ranking } from '~/components/ranking';
import { Button } from '~/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '~/components/ui/tabs';
import { Text } from '~/components/ui/text';

type HighlineTabs = 'details' | 'ranking';

export default function HighlinePage() {
  const { isConnected } = useNetInfo();
  const { locale } = useI18n();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [tab, setTab] = useState<HighlineTabs>('details');

  const [bottomActionsHeight, setBottomActionsHeight] = useState(0);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { highline, isPending } = useHighline({ id });

  const shareListing = async () => {
    if (!highline) return;
    try {
      const url = `${process.env.EXPO_PUBLIC_WEB_URL}/highline/${highline.id}`;
      await Share.share({
        title: locale === 'en' ? 'See on Chooselife' : 'Veja no Chooselife',

        message:
          locale === 'en'
            ? `Highline ${highline.name} on the Choose Life APP!\n\n🔗 Access now: ${url}`
            : `Via "${highline.name}" no APP Choose Life!\n\n🔗 Acesse agora: ${url}`,
      });
    } catch (err) {
      console.log('Erro ao compartilhar a highline:', err);
    }
  };

  const tabs = useMemo(
    () => [
      {
        id: 'details',
        label: 'Detalhes',
        content: <Info />,
      },
      {
        id: 'ranking',
        label: 'Ranking',
        content: <Ranking highlines_ids={[highline?.id || '']} />,
      },
    ],
    [highline?.id],
  );

  // Padding to add to the ScrollView so the bottom actions doesn't overlap it
  const paddingBottom = useMemo(
    () => bottomActionsHeight + insets.bottom + 18,
    [bottomActionsHeight, insets.bottom],
  );

  const handleBottomActionsLayout = useCallback((event: LayoutChangeEvent) => {
    setBottomActionsHeight(event.nativeEvent.layout.height);
  }, []);

  if (isPending) {
    return <HighlineSkeleton />;
  }

  if (!highline) {
    return <HighlineNotFound />;
  }

  return (
    <>
      <ScrollView
        contentContainerStyle={{
          paddingBottom,
        }}
      >
        <OfflineBanner />
        <View
          className="absolute px-4 flex-row justify-between w-full top-0 z-50"
          style={{
            // If offline, the <OfflineBanner />  will render, so these buttons need additional padding
            paddingTop: isConnected ? insets.top : insets.top * 2,
          }}
        >
          <TouchableOpacity
            className="p-2 rounded-full bg-white items-center justify-center"
            onPress={() =>
              router.canGoBack() ? router.back() : router.replace('/(tabs)')
            }
          >
            <LucideIcon name="ChevronLeft" className="text-primary size-6" />
          </TouchableOpacity>
          <View className="flex-row items-center justify-center gap-3">
            <Link href={`/highline/${id}/edit`} asChild>
              <TouchableOpacity className="p-2 rounded-full bg-white items-center justify-center">
                <LucideIcon name="Pencil" className="text-primary size-6" />
              </TouchableOpacity>
            </Link>
            <TouchableOpacity
              className="p-2 rounded-full bg-white items-center justify-center"
              onPress={shareListing}
            >
              <LucideIcon name="Share" className="text-primary size-6" />
            </TouchableOpacity>
            <FavoriteHighline
              isFavorite={!!highline?.is_favorite}
              id={highline?.id}
            />
          </View>
        </View>

        <HighlineImage
          coverImageId={highline.cover_image}
          className="w-full h-96"
        />

        <View className="px-4 pt-4 gap-6 flex-1">
          <Tabs
            className="flex-1"
            value={tab}
            onValueChange={(val) => setTab(val as HighlineTabs)}
          >
            <TabsList className="flex-row">
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
        </View>
      </ScrollView>

      {tab === 'details' ? (
        <BottomActions
          hasLocation={!!highline.anchor_a_lat}
          onLayout={handleBottomActionsLayout}
        />
      ) : null}

      <RigModal />
    </>
  );
}

const BottomActions = ({
  hasLocation,
  onLayout,
}: {
  hasLocation: boolean;
  onLayout: (event: LayoutChangeEvent) => void;
}) => {
  const { t } = useTranslation();
  const router = useRouter();
  const { profile } = useAuth();
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();

  return (
    <View
      onLayout={onLayout}
      className="absolute bottom-0 flex flex-row gap-4 w-full bg-background px-2 pt-4 border-t border-muted"
      style={{
        paddingBottom: insets.bottom + 16,
        shadowColor: '#000',
        shadowOffset: {
          width: 0,
          height: 2,
        },
        shadowOpacity: 0.23,
        shadowRadius: 2.62,

        elevation: 4,
      }}
    >
      <Link
        className="flex-1"
        href={{ pathname: '/(tabs)', params: { focusedMarker: id } }}
        asChild
      >
        <Button className="flex-1 flex-row gap-2 items-start" variant="outline">
          {hasLocation ? (
            <>
              <LucideIcon name="Earth" className="size-6 text-primary" />
              <Text className="text-primary">
                {t('app.highline.index.BottomActions.seeOnMap')}
              </Text>
            </>
          ) : (
            <>
              <View className="size-8 text-primary">
                <MarkerCL active={false} />
              </View>
              <Text className="text-primary">
                {t('app.highline.index.BottomActions.addToMap')}
              </Text>
            </>
          )}
        </Button>
      </Link>

      <Button
        className="flex-1"
        onPress={() => {
          const route = `/highline/${id}/register` as const;
          if (!profile) {
            router.push(`/(modals)/login?redirect_to=${route}`);
            return;
          }
          router.push(route);
        }}
      >
        <Text className="text-primary-foreground">
          {t('app.highline.index.BottomActions.register')}
        </Text>
      </Button>
    </View>
  );
};
