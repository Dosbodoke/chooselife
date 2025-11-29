import { useLocalSearchParams, useRouter } from 'expo-router';
import React from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useOrganization } from '@chooselife/ui';
import { LucideIcon } from '~/lib/icons/lucide-icon';

import { Carousel } from '~/components/organizations/showcase-carousel';

export default function MemberShowcaseScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { slug } = useLocalSearchParams<{ slug: string }>();

  const {
    data: organization,
    isLoading,
    isError,
  } = useOrganization(slug || '');

  if (!slug || isError || !organization) {
    return (
      <View className="flex-1 justify-center items-center">
        <Text>Organization not found.</Text>
      </View>
    );
  }

  if (isLoading) {
    return (
      <View className="flex-1 justify-center items-center">
        <ActivityIndicator />
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

      <Carousel org={organization} />
    </View>
  );
}
