/**
 * PROTOTYPE variant B, "Peek cards": a dated page title on the plain
 * background, then inset cards that scroll sideways with the next one
 * peeking in. Image on top, copy on the card surface below, never on the photo.
 */
import { Image } from 'expo-image';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useI18n } from '~/context/i18n';

import { Text } from '~/components/ui/text';

import { imageSource, type PromoItem } from './types';

const GAP = 12;
const GUTTER = 16;
const PEEK = 28;
const IMAGE_HEIGHT = 176;

export function PeekCards({ items }: { items: PromoItem[] }) {
  const { top } = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { locale } = useI18n();
  const cardWidth = width - GUTTER * 2 - (items.length > 1 ? PEEK : 0);
  const today = new Date().toLocaleDateString(locale, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  return (
    <View style={{ paddingTop: top + 12 }}>
      <View className="mb-4 px-4">
        <Text className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          {today}
        </Text>
        <Text className="text-[32px] font-black leading-[38px] tracking-tight">
          Destaques
        </Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={cardWidth + GAP}
        decelerationRate="fast"
        contentContainerStyle={{ paddingHorizontal: GUTTER, gap: GAP }}
      >
        {items.map((item) => (
          <PeekCard key={item.id} item={item} width={cardWidth} />
        ))}
      </ScrollView>
    </View>
  );
}

function PeekCard({ item, width }: { item: PromoItem; width: number }) {
  const { t } = useTranslation();

  return (
    <Pressable
      onPress={item.onPress}
      accessibilityRole="button"
      accessibilityLabel={item.title}
      style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.98 : 1 }] })}
    >
      <View
        className="overflow-hidden rounded-[28px] border border-border bg-card"
        style={{ width, borderCurve: 'continuous' }}
      >
        <View
          style={{
            height: IMAGE_HEIGHT,
            backgroundColor: item.surface ?? '#000',
          }}
        >
          <Image
            source={imageSource(item.image)}
            style={{ flex: 1 }}
            contentFit={item.kind === 'photo' ? 'cover' : 'contain'}
            cachePolicy="disk"
          />
          {item.kind === 'artwork' ? (
            <View className="absolute inset-x-0 bottom-0 h-px bg-border" />
          ) : null}
        </View>

        <View className="flex-row items-center gap-3 p-4">
          <View className="flex-1">
            <Text className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
              {item.eyebrow}
            </Text>
            <Text
              className="mt-0.5 text-xl font-bold tracking-tight"
              numberOfLines={1}
            >
              {item.title}
            </Text>
            {item.subtitle ? (
              <Text
                className="text-sm text-muted-foreground"
                numberOfLines={1}
              >
                {item.subtitle}
              </Text>
            ) : null}
          </View>
          <View className="rounded-full bg-secondary px-4 py-2">
            <Text className="text-sm font-semibold text-secondary-foreground">
              {t('app.(tabs).home.quickActions.open')}
            </Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
}
