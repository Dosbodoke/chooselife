import { Link } from 'expo-router';
import { MoveHorizontalIcon, MoveVerticalIcon } from 'lucide-react-native';
import { cssInterop } from 'nativewind';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Text, TouchableOpacity, View, Pressable } from 'react-native';
import SquircleView from 'react-native-fast-squircle';
import Animated, { FadeInRight, FadeOutLeft } from 'react-native-reanimated';

import type { Highline } from '~/hooks/use-highline';
import { RigStatuses } from '~/hooks/use-rig-setup';
import { cn } from '~/lib/utils';

import { Icon } from '~/components/ui/icon';

import { FavoriteHighline } from './favorite-button';
import { HighlineImage } from './highline-image';

const ReanimatedSquircleView = Animated.createAnimatedComponent(SquircleView);
cssInterop(ReanimatedSquircleView, {
  className: {
    target: 'style',
  },
});

interface HighlineCardProps {
  item: Highline;
  className?: string;
  onPress?: () => void;
  isFocused?: boolean;
}

interface CardContentProps {
  item: Highline;
}

const StatusChip: React.FC<{ status: RigStatuses }> = ({ status }) => {
  const { t } = useTranslation();

  const dotStyle: Record<RigStatuses, string> = {
    planned: 'bg-amber-300',
    rigged: 'bg-green-500',
    unrigged: 'bg-red-500',
  };

  return (
    <View className="bg-black/60 py-1.5 px-3 rounded-full flex flex-row gap-2 items-center backdrop-blur-md border border-white/10">
      <View className={cn('size-2 rounded-full', dotStyle[status])} />
      <Text className="text-white text-xs font-bold tracking-wide">
        {t(`components.map.explore-header.categories.${status}`)}
      </Text>
    </View>
  );
};

const StatsPills: React.FC<{ height: number; length: number }> = ({ height, length }) => (
  <View className="flex-row gap-2">
    <View className="flex-row items-center bg-black/40 px-2 py-1 rounded-lg backdrop-blur-sm border border-white/10">
      <Icon as={MoveVerticalIcon} className="text-white/90 size-3 mr-1" />
      <Text className="text-white text-xs font-bold">{height}m</Text>
    </View>
    <View className="flex-row items-center bg-black/40 px-2 py-1 rounded-lg backdrop-blur-sm border border-white/10">
      <Icon as={MoveHorizontalIcon} className="text-white/90 size-3 mr-1" />
      <Text className="text-white text-xs font-bold">{length}m</Text>
    </View>
  </View>
);

// ============================================================================
// Card Content (renders inside the squircle)
// ============================================================================

const CardContent: React.FC<CardContentProps> = ({ item }) => {
  return (
    <>
      {/* Background Image */}
      <View className="absolute inset-0">
        <HighlineImage coverImageId={item.cover_image} className="h-full w-full" />
      </View>

      {/* Gradient Overlay */}
      <View
        className="absolute bottom-0 w-full h-2/3"
        style={{
          experimental_backgroundImage:
            'linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.4) 60%, transparent 100%)',
        }}
      />

      {/* Content */}
      <View className="flex-1 p-4 justify-between">
        {/* Top Row */}
        <View className="flex-row justify-between items-start">
          <StatusChip status={item.status as RigStatuses} />
          <FavoriteHighline
            isFavorite={item.is_favorite}
            id={item.id}
            className="bg-black/60"
          />
        </View>

        {/* Bottom Content */}
        <View className="gap-1.5">
          <Text
            className="text-xl font-bold text-white leading-tight"
            numberOfLines={2}
            style={{
              textShadowColor: 'rgba(0, 0, 0, 0.5)',
              textShadowOffset: { width: 0, height: 1 },
              textShadowRadius: 3,
            }}
          >
            {item.name}
          </Text>
          <StatsPills height={item.height} length={item.length} />
        </View>
      </View>
    </>
  );
};

export const HighlineCard: React.FC<HighlineCardProps> = ({
  item,
  className,
  onPress,
  isFocused,
}) => {
  const content = (
    <ReanimatedSquircleView
      className={cn(
        'h-48 w-full overflow-hidden rounded-2xl bg-muted relative mb-3',
        isFocused && 'border-2 border-blue-500',
        className,
      )}
      cornerSmoothing={1}
      entering={FadeInRight}
      exiting={FadeOutLeft}
    >
      <CardContent item={item} />
    </ReanimatedSquircleView>
  );

  if (onPress) {
    return <Pressable onPress={onPress}>{content}</Pressable>;
  }

  return (
    <Link href={`/highline/${item.id}`} asChild>
      <TouchableOpacity activeOpacity={0.9}>{content}</TouchableOpacity>
    </Link>
  );
};
