import { Link } from 'expo-router';
import { useAtomValue } from 'jotai';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, TouchableOpacity, View } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import Animated, { Easing, FadeIn, FadeOut } from 'react-native-reanimated';

import type { Highline } from '~/hooks/use-highline';
import { LucideIcon } from '~/lib/icons/lucide-icon';
import { cn } from '~/lib/utils';

import { Text } from '~/components/ui/text';
import { H4, Small } from '~/components/ui/typography';

import { HighlineImage } from '../highline/highline-image';
import { bottomSheetHandlerHeightAtom } from './bottom-sheet';

interface MapCardProps {
  highline: Highline;
  isFocused: boolean;
  onPress: (high: Highline) => void;
}

const MapCard: React.FC<MapCardProps> = ({ highline, isFocused, onPress }) => {
  const { t } = useTranslation();
  return (
    <Pressable
      onPress={() => onPress(highline)}
      className={cn(
        'inline-block rounded-lg border border-border bg-background shadow shadow-foreground/10',
        'h-32 min-w-[24rem]',
        isFocused ? 'border border-blue-500 dark:border-blue-600' : 'border-0',
      )}
    >
      <View className="flex flex-row h-full gap-2 p-0">
        <View className="relative h-full w-20 rounded-l-md bg-muted-foreground">
          <HighlineImage
            coverImageId={highline.cover_image}
            className="w-full h-full rounded-l-md"
            dotSize="small"
          />
        </View>
        <View className="flex flex-1 py-2 pr-2">
          <H4 className="text-sm font-semibold">{highline.name}</H4>
          <View className="flex gap-2 flex-row">
            <View className="flex items-center pt-2 flex-row">
              <LucideIcon
                name="UnfoldVertical"
                className="size-4 mr-2 text-primary opacity-70"
              />
              <Small className="text-xs text-muted-foreground">
                {highline.height}m
              </Small>
            </View>
            <View className="flex items-center pt-2 flex-row">
              <LucideIcon
                name="UnfoldHorizontal"
                className="size-4 mr-2 text-primary opacity-70"
              />
              <Small className="text-xs text-muted-foreground">
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

export const MapCardList = ({
  highlines,
  focusedMarker,
  changeFocusedMarker,
}: {
  highlines: Highline[];
  focusedMarker: Highline | null;
  changeFocusedMarker: (high: Highline) => void;
}) => {
  const bottomSheetHandlerHeight = useAtomValue(bottomSheetHandlerHeightAtom);
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
          <MapCard
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
