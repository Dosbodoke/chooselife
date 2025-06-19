import { useMapStore } from '~/store/map-store';
import { Link } from 'expo-router';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, TouchableOpacity, View } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import Animated, { Easing, FadeIn, FadeOut } from 'react-native-reanimated';

import type { Highline } from '~/hooks/use-highline';
import { RigStatuses } from '~/hooks/use-rig-setup';
import { LucideIcon } from '~/lib/icons/lucide-icon';
import { cn } from '~/lib/utils';
import { highlinesID } from '~/utils/festival-data';

import { Text } from '~/components/ui/text';
import { H4, Small } from '~/components/ui/typography';

import { FavoriteHighline } from '../highline/favorite-button';
import { HighlineImage } from '../highline/highline-image';

interface MapCardProps {
  highline: Highline;
  isFocused: boolean;
  onPress: (high: Highline) => void;
}

export const HighlineMapCard: React.FC<MapCardProps> = ({
  highline,
  isFocused,
  onPress,
}) => {
  const isFestivalHighline = highlinesID.includes(highline.id);

  const { t } = useTranslation();
  return (
    <Pressable
      onPress={() => onPress(highline)}
      className={cn(
        'inline-block rounded-lg bg-background shadow shadow-foreground/10',
        'aspect-video min-w-[24rem] overflow-hidden',
        isFocused
          ? 'border border-blue-500 dark:border-blue-600'
          : 'border border-border',
      )}
    >
      <View className="flex flex-row h-full gap-2 p-0">
        <View className="absolute inset-0 bg-muted-foreground">
          <HighlineImage
            coverImageId={highline.cover_image}
            className="w-full h-full"
            dotSize="small"
          />
        </View>

        <StatusChip
          status={
            isFestivalHighline ? 'rigged' : (highline.status as RigStatuses)
          }
        />

        <View className="absolute top-2 right-2">
          <FavoriteHighline
            id={highline.id}
            isFavorite={highline.is_favorite}
            className="bg-black/60"
            hearthClassName="text-white"
          />
        </View>

        <View
          className={cn(
            'absolute rounded-md inset-x-3 flex gap-2 bg-background bottom-3 p-2',
            isFocused
              ? 'border-2 border-blue-500 dark:border-blue-600'
              : 'border-0',
          )}
        >
          <H4 className="text-base font-semibold">{highline.name}</H4>
          <View className="flex gap-2 flex-row">
            <View className="flex items-center pt-2 flex-row">
              <LucideIcon
                name="UnfoldVertical"
                className="size-4 mr-2 text-primary opacity-70"
              />
              <Small className="text-sm text-muted-foreground">
                {highline.height}m
              </Small>
            </View>
            <View className="flex items-center pt-2 flex-row">
              <LucideIcon
                name="UnfoldHorizontal"
                className="size-4 mr-2 text-primary opacity-70"
              />
              <Small className="text-sm text-muted-foreground">
                {highline.length}m
              </Small>
            </View>
          </View>
          <Link href={`/highline/${highline.id}`} asChild>
            <TouchableOpacity className="flex-row gap-1 mt-auto items-center">
              <Text className="text-blue-500">
                {t('components.map.map-card.seeDatails')}
              </Text>
              <LucideIcon name="ArrowRight" className="size-4 text-blue-500" />
            </TouchableOpacity>
          </Link>
        </View>
      </View>
    </Pressable>
  );
};

const StatusChip: React.FC<{ status: RigStatuses }> = ({ status }) => {
  const { t } = useTranslation();

  const dotStyle: Record<RigStatuses, string> = {
    planned: 'bg-amber-300',
    rigged: 'bg-green-500',
    unrigged: 'bg-red-500',
  };

  return (
    <View className="absolute top-2 left-2 bg-black/60 py-2 px-4 rounded-full flex flex-row gap-2 items-center">
      <View className={cn('size-2 rounded-full', dotStyle[status])} />
      <Text className="text-white text-sm font-semibold tracking-wide">
        {t(`components.map.explore-header.categories.${status}`)}
      </Text>
    </View>
  );
};

export const MapCardList = ({
  highlines,
  focusedMarker,
  changeFocusedMarker,
}: {
  highlines: Highline[];
  focusedMarker: Highline | null;
  changeFocusedMarker: (high: Highline) => void;
}) => {
  const bottomSheetHandlerHeight = useMapStore(
    (state) => state.bottomSheetHandlerHeight,
  );
  return (
    <Animated.View
      entering={FadeIn.duration(300).easing(Easing.inOut(Easing.ease))}
      exiting={FadeOut.duration(300).easing(Easing.inOut(Easing.ease))}
      style={{
        position: 'absolute',
        bottom: bottomSheetHandlerHeight + 16, // Bottom sheet handle + padding
        left: 0,
        right: 0,
      }}
    >
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerClassName="px-2 gap-4"
      >
        {highlines.map((high) => (
          <HighlineMapCard
            key={`highline-card-${high.id}`}
            highline={high}
            isFocused={high.id === focusedMarker?.id}
            onPress={changeFocusedMarker}
          />
        ))}
      </ScrollView>
    </Animated.View>
  );
};
