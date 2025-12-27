import { Link } from 'expo-router';
import { MoveHorizontalIcon, MoveVerticalIcon } from 'lucide-react-native';
import { cssInterop } from 'nativewind';
import { Text, TouchableOpacity, View } from 'react-native';
import SquircleView from 'react-native-fast-squircle';
import Animated, { FadeInRight, FadeOutLeft } from 'react-native-reanimated';

import type { Highline } from '~/hooks/use-highline';

import { Icon } from '~/components/ui/icon';

import { FavoriteHighline } from './favorite-button';
import { HighlineImage } from './highline-image';

import { GlassContainer, GlassView } from 'expo-glass-effect';

const ReanimatedSquircleView = Animated.createAnimatedComponent(SquircleView);
cssInterop(ReanimatedSquircleView, {
  className: {
    target: 'style',
  },
});
cssInterop(GlassView, {
  className: {
    target: 'style',
  },
});
cssInterop(GlassContainer, {
  className: {
    target: 'style',
  },
});


export const HighlineCard: React.FC<{ item: Highline }> = ({ item }) => {
  return (
    <Link href={`/highline/${item.id}`} asChild>
      <TouchableOpacity activeOpacity={0.9}>
        <ReanimatedSquircleView
          className="h-64 w-full overflow-hidden rounded-3xl bg-muted relative mb-4 shadow-sm"
          cornerSmoothing={1}
          entering={FadeInRight}
          exiting={FadeOutLeft}
        >
          {/* Background Image - Absolute positioning to fill card */}
          <View className="absolute inset-0">
            <HighlineImage
              coverImageId={item.cover_image}
              className="h-full w-full"
            />
          </View>

          {/* Dark Overlay for text readability */}
          <View className="absolute inset-0 bg-black/30" />

          {/* Gradient Overlay using experimental_backgroundImage */}
          <View
            className="absolute bottom-0 w-full h-3/5"
            style={{
              experimental_backgroundImage:
                'linear-gradient(to top, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.6) 40%, transparent 100%)',
            }}
          />

          {/* Content Container */}
          <View className="flex-1 p-5 justify-between">
            {/* Top Row: Favorite Button */}
            <View className="flex-row justify-end">
                <FavoriteHighline isFavorite={item.is_favorite} id={item.id} />
            </View>

            {/* Bottom Content: Title & Stats */}
            <View className="gap-2">
              <Text
                className="text-2xl font-extrabold text-white shadow-md leading-tight"
                numberOfLines={2}
                style={{
                  textShadowColor: 'rgba(0, 0, 0, 0.5)',
                  textShadowOffset: { width: 0, height: 1 },
                  textShadowRadius: 4,
                }}
              >
                {item.name}
              </Text>

              <GlassContainer className="flex-row gap-3">
                {/* Height Pill */}
                <GlassView className="flex-row items-center bg-black/40 px-2.5 py-1.5 rounded-lg backdrop-blur-sm border border-white/10">
                  <Icon
                    as={MoveVerticalIcon}
                    className="text-white/90 size-3.5 mr-1.5"
                  />
                  <Text className="text-white text-xs font-bold tracking-wide">
                    {item.height}m
                  </Text>
                </GlassView>

                {/* Length Pill */}
                <GlassView className="flex-row items-center bg-black/40 px-2.5 py-1.5 rounded-lg backdrop-blur-sm border border-white/10">
                  <Icon
                    as={MoveHorizontalIcon}
                    className="text-white/90 size-3.5 mr-1.5"
                  />
                  <Text className="text-white text-xs font-bold tracking-wide">
                    {item.length}m
                  </Text>
                </GlassView>
              </GlassContainer>
            </View>
          </View>
        </ReanimatedSquircleView>
      </TouchableOpacity>
    </Link>
  );
};
