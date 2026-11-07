/**
 * PROTOTYPE variant C, "Compact list": no hero at all. Promos become a
 * grouped list of rows with a thumbnail, so the quick actions and events
 * move up into the first screen.
 */
import { Image } from 'expo-image';
import { ChevronRightIcon } from 'lucide-react-native';
import React from 'react';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '~/components/ui/icon';
import { Text } from '~/components/ui/text';

import { imageSource, type PromoItem } from './types';

const THUMB = 56;

export function CompactList({ items }: { items: PromoItem[] }) {
  const { top } = useSafeAreaInsets();

  return (
    <View className="px-4" style={{ paddingTop: top + 16 }}>
      <Text className="mb-3 text-lg font-bold">Destaques</Text>
      <View
        className="overflow-hidden rounded-3xl bg-secondary"
        style={{ borderCurve: 'continuous' }}
      >
        {items.map((item, i) => (
          <React.Fragment key={item.id}>
            {i > 0 ? (
              <View
                className="h-px bg-border"
                style={{ marginLeft: THUMB + 24 }}
              />
            ) : null}
            <Row item={item} />
          </React.Fragment>
        ))}
      </View>
    </View>
  );
}

function Row({ item }: { item: PromoItem }) {
  return (
    <Pressable
      onPress={item.onPress}
      accessibilityRole="button"
      accessibilityLabel={item.title}
      accessibilityHint={item.cta}
      className="flex-row items-center gap-3 p-3 active:bg-black/5"
    >
      <View
        className="overflow-hidden rounded-2xl border border-border"
        style={{
          width: THUMB,
          height: THUMB,
          borderCurve: 'continuous',
          backgroundColor: item.surface ?? '#000',
        }}
      >
        <Image
          source={imageSource(item.image)}
          style={{ flex: 1 }}
          contentFit="cover"
          cachePolicy="disk"
        />
      </View>

      <View className="flex-1">
        <Text className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {item.eyebrow}
        </Text>
        <Text className="text-base font-semibold" numberOfLines={1}>
          {item.title}
        </Text>
        {item.subtitle ? (
          <Text className="text-sm text-muted-foreground" numberOfLines={1}>
            {item.subtitle}
          </Text>
        ) : null}
      </View>

      <Icon as={ChevronRightIcon} size={18} className="text-muted-foreground" />
    </Pressable>
  );
}
