import React from "react";
import { View, Pressable, Image } from "react-native";
import { UnfoldHorizontal } from "~/lib/icons/UnfoldHorizontal";
import { UnfoldVertical } from "~/lib/icons/UnfoldVertical";
import { ArrowRight } from "~/lib/icons/ArrowRight";
import { Link } from "expo-router";
import { H4, Small } from "../ui/typography";
import { Text } from "../ui/text";
import { ScrollView } from "react-native-gesture-handler";
import Animated, { FadeIn, FadeOut, Easing } from "react-native-reanimated";

import type { Highline } from "~/hooks/useHighline";
import { cn } from "~/lib/utils";
import { supabase } from "~/lib/supabase";

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
        "inline-block rounded-lg border border-border bg-accent text-accent-foreground shadow-sm shadow-foreground/10",
        "h-32 min-w-[20rem]",
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
              <UnfoldVertical className="mr-2 h-4 w-4 opacity-70" />
              <Small className="text-xs text-muted-foreground">
                {highline.height}m
              </Small>
            </View>
            <View className="flex items-center pt-2 flex-row">
              <UnfoldHorizontal className="mr-2 h-4 w-4 opacity-70" />
              <Small className="text-xs text-muted-foreground">
                {highline.lenght}m
              </Small>
            </View>
          </View>
          <Link
            className="mt-auto flex flex-row items-center"
            href={`/highline/${highline.id}`}
          >
            <Text className="text-blue-500">Ver detalhes</Text>
            <ArrowRight className="text-blue-500 ml-2 size-3" />
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
      style={{ position: "absolute", bottom: 28, left: 0, right: 0 }}
    >
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{
          columnGap: 16,
          paddingRight: 16,
          paddingLeft: 16,
        }}
        className="absolute bottom-28"
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
