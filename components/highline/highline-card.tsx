import { View, Text, TouchableOpacity } from "react-native";
import { Link } from "expo-router";
import Animated, { FadeInRight, FadeOutLeft } from "react-native-reanimated";

import { supabase } from "~/lib/supabase";
import { UnfoldHorizontal } from "~/lib/icons/UnfoldHorizontal";
import { UnfoldVertical } from "~/lib/icons/UnfoldVertical";
import { FavoriteHighline } from "./favorite-button";
import type { Highline } from "~/hooks/useHighline";

export const HighlineCard = ({ item }: { item: Highline }) => {
  return (
    <Link href={`/highline/${item.id}`} asChild>
      <TouchableOpacity>
        <Animated.View
          className="p-4 gap-2 my-4"
          entering={FadeInRight}
          exiting={FadeOutLeft}
        >
          <Animated.Image
            source={{
              uri: supabase.storage
                .from("images")
                .getPublicUrl(item.cover_image).data.publicUrl,
            }}
            className="w-full h-80 rounded-xl bg-muted"
          />
          <View className="absolute right-7 top-7">
            <FavoriteHighline isFavorite={item.is_favorite} id={item.id} />
          </View>
          <Text className="text-base text-foreground">{item.name}</Text>
          <View className="flex flex-row items-center gap-4 text-sm text-muted-foreground">
            <View className="flex flex-row gap-2 items-center">
              <UnfoldVertical className="text-muted-foreground" />
              <Text className="text-muted-foreground">{item.height}m</Text>
            </View>
            <View className="flex flex-row gap-2 items-center">
              <UnfoldHorizontal className="text-muted-foreground" />
              <Text className="text-muted-foreground">{item.lenght}m</Text>
            </View>
          </View>
        </Animated.View>
      </TouchableOpacity>
    </Link>
  );
};
