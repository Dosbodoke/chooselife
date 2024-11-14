import React from "react";
import { View, Pressable, Image, TouchableOpacity } from "react-native";
import Animated, { FadeIn, FadeOut, Easing } from "react-native-reanimated";
import { ScrollView } from "react-native-gesture-handler";
import { Link } from "expo-router";

import type { Highline } from "~/hooks/use-highline";
import { cn } from "~/lib/utils";
import { supabase } from "~/lib/supabase";
import { LucideIcon } from "~/lib/icons/lucide-icon";

import { H4, Small } from "~/components/ui/typography";
import { Text } from "~/components/ui/text";

interface HighlineCardProps {
  highline: Highline;
  isFocused: boolean;
  onPress: (high: Highline) => void;
}

const HighlineCard: React.FC<HighlineCardProps> = ({
  highline,
  isFocused,
  onPress,
}) => {
  return (
    <Pressable
      onPress={() => onPress(highline)}
      className={cn(
        "inline-block rounded-lg border border-border bg-accent text-accent-foreground shadow shadow-foreground/10",
        "h-32 min-w-[24rem]",
        isFocused ? "border border-blue-500 dark:border-blue-600" : "border-0"
      )}
    >
      <View className="flex flex-row h-full gap-2 p-0">
        <View className="relative h-full w-20 rounded-l-md bg-muted-foreground">
          <Image
            source={{
              uri: supabase.storage
                .from("images")
                .getPublicUrl(highline.cover_image).data.publicUrl,
            }}
            className="w-full h-full rounded-l-md"
            resizeMode="cover"
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
                {highline.lenght}m
              </Small>
            </View>
          </View>
          <Link href={`/highline/${highline.id}`} asChild>
            <TouchableOpacity className="flex-row gap-1 mt-auto items-center">
              <Text className="text-blue-500">Ver detalhes</Text>
              <LucideIcon name="ArrowRight" className="size-4 text-blue-500" />
            </TouchableOpacity>
          </Link>
        </View>
      </View>
    </Pressable>
  );
};

export default HighlineCard;

export const MapCardList = ({
  highlines,
  focusedMarker,
  changeFocusedMarker,
}: {
  highlines: Highline[];
  focusedMarker: Highline | null;
  changeFocusedMarker: (high: Highline) => void;
}) => {
  return (
    <Animated.View
      entering={FadeIn.duration(300).easing(Easing.inOut(Easing.ease))}
      exiting={FadeOut.duration(300).easing(Easing.inOut(Easing.ease))}
      style={{ position: "absolute", bottom: 96, left: 0, right: 0 }}
    >
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerClassName="px-2 gap-4"
      >
        {highlines.map((high) => (
          <HighlineCard
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
