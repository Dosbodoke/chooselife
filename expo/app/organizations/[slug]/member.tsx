import { useOrganization } from '@chooselife/ui';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { XIcon } from 'lucide-react-native';
import React from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Carousel } from '~/components/organizations/showcase-carousel';
import { Icon } from '~/components/ui/icon';

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
        <Icon as={XIcon} size={20} className="fill-muted" />
      </Pressable>

      <Carousel org={organization} />
    </View>
  );
}
