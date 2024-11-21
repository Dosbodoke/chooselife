import { Link } from 'expo-router';
import { Text, TouchableOpacity, View } from 'react-native';
import Animated, { FadeInRight, FadeOutLeft } from 'react-native-reanimated';

import type { Highline } from '~/hooks/use-highline';
import { LucideIcon } from '~/lib/icons/lucide-icon';

import { FavoriteHighline } from './favorite-button';
import { HighlineImage } from './highline-image';

export const HighlineCard: React.FC<{ item: Highline }> = ({ item }) => {
  return (
    <Link href={`/highline/${item.id}`} asChild>
      <TouchableOpacity>
        <Animated.View
          className="p-4 gap-2 my-4"
          entering={FadeInRight}
          exiting={FadeOutLeft}
        >
          <HighlineImage
            coverImageId={item.cover_image}
            className="w-full h-80 rounded-xl bg-muted"
          />
          <View className="absolute right-7 top-7">
            <FavoriteHighline isFavorite={item.is_favorite} id={item.id} />
          </View>
          <Text className="text-base text-foreground">{item.name}</Text>
          <View className="flex flex-row items-center gap-4 text-sm text-muted-foreground">
            <View className="flex flex-row gap-2 items-center">
              <LucideIcon
                name="UnfoldVertical"
                className="size-4 mr-2 text-primary opacity-70"
              />
              <Text className="text-muted-foreground">{item.height}m</Text>
            </View>
            <View className="flex flex-row gap-2 items-center">
              <LucideIcon
                name="UnfoldHorizontal"
                className="size-4 mr-2 text-primary opacity-70"
              />
              <Text className="text-muted-foreground">{item.lenght}m</Text>
            </View>
          </View>
        </Animated.View>
      </TouchableOpacity>
    </Link>
  );
};
