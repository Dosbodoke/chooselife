import { useLocalSearchParams, useRouter } from 'expo-router';
import React from 'react';
import { Pressable, View, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LucideIcon } from '~/lib/icons/lucide-icon';

import { Carousel } from '~/components/organizations/showcase-carousel';

export default function MemberShowcaseScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { slug } = useLocalSearchParams<{ slug: string }>();

  if (!slug) {
    return (
      <View className="flex-1 justify-center items-center">
        <Text>Organization not found.</Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-white">
      <Pressable
        onPress={router.back}
        className="absolute right-6 p-2.5 rounded-full bg-foreground/10 z-50"
        style={{
          top: insets.top + 12,
        }}
        hitSlop={12}
      >
        <LucideIcon name="X" size={20} className="fill-muted" />
      </Pressable>

      <Carousel slug={slug} />
    </View>
  );
}
