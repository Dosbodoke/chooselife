import * as Linking from 'expo-linking';
import { Link, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useMemo, useRef, useState } from 'react';
import {
  ScrollView,
  Share,
  TouchableOpacity,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '~/context/auth';
import { useHighline } from '~/hooks/use-highline';
import { LucideIcon } from '~/lib/icons/lucide-icon';
import { MarkerCL } from '~/lib/icons/MarkerCL';

import { FavoriteHighline } from '~/components/highline/favorite-button';
import { HighlineImage } from '~/components/highline/highline-image';
import Info from '~/components/highline/info';
import { HighlineNotFound } from '~/components/highline/not-found';
import { RigModal } from '~/components/highline/rig-confirmations';
import { HighlineSkeleton } from '~/components/highline/skeleton';
import { Ranking } from '~/components/ranking';
import { Button } from '~/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '~/components/ui/tabs';
import { Text } from '~/components/ui/text';

type HighlineTabs = 'details' | 'ranking';

export default function HighlinePage() {
  const { id } = useLocalSearchParams<{
    id: string;
  }>();
  const [tab, setTab] = useState<HighlineTabs>('details');

  const bottomActionsHeightRef = useRef(0);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { highline, isPending } = useHighline({ id });

  const shareListing = async () => {
    if (!highline) return;
    try {
      const url = Linking.createURL(`highline/${highline.id}`);
      await Share.share({
        title: 'Veja no Chooselife',
        message: `🚀 Confira esse Highline incrível no APP Chooselife: "${highline.name}"!\n\nBaixe o app para explorar mais locais, rankings e atividades exclusivas no mundo das highlines.\n\n🔗 Acesse agora: ${url}`,
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
          paddingBottom: bottomActionsHeightRef.current + 26,
        }}
      >
        <View
          className="absolute px-4 flex-row justify-between w-full top-0 z-50"
          style={{
            paddingTop: insets.top,
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
          onLayout={(event) => {
            bottomActionsHeightRef.current = event.nativeEvent.layout.height;
          }}
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
              <Text className="text-primary">Ver no mapa</Text>
            </>
          ) : (
            <>
              <View className="size-8 text-primary">
                <MarkerCL active={false} />
              </View>
              <Text className="text-primary">Adicionar ao mapa</Text>
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
        <Text className="text-primary-foreground">Registrar rolê</Text>
      </Button>
    </View>
  );
};
