import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Pressable, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import Animated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  Extrapolation,
} from "react-native-reanimated";

import { supabase } from "~/lib/supabase";
import type { Highline } from "~/hooks/use-highline";
import { useAuth } from "~/context/auth";
import { LucideIcon } from "~/lib/icons/lucide-icon";

export function FavoriteHighline({
  isFavorite,
  id,
}: {
  isFavorite: boolean;
  id: string;
}) {
  const { session } = useAuth();

  const [favorite, setFavorite] = useState(isFavorite);
  const queryClient = useQueryClient();
  const router = useRouter();

  const liked = useSharedValue(isFavorite ? 1 : 0);

  const { mutate, isPending } = useMutation({
    mutationFn: async () => {
      if (!session?.user) return;
      if (favorite) {
        // Delete from favorites
        const { error } = await supabase
          .from("favorite_highline")
          .delete()
          .match({ highline_id: id, profile_id: session.user.id });
        if (error) throw new Error(error.message);
      } else {
        // Insert into favorites
        const { error } = await supabase
          .from("favorite_highline")
          .insert({ highline_id: id, profile_id: session.user.id });
        if (error) throw new Error(error.message);
      }
    },
    onMutate: async () => {
      if (!session?.user) {
        router.push(`/(modals)/login?redirect_to=highline/${id}`);
        throw new Error("User not logged in");
      }
      // Start animation
      liked.value = withSpring(liked.value ? 0 : 1);
      // Perform optimistic update
      setFavorite((prev) => !prev);

      // Snapshot the previous value
      const previousValue = queryClient.getQueryData<Highline>([
        "highline",
        id,
      ]);

      // Optimistically update the cache with new value
      queryClient.setQueryData(["highline", id], (old: Highline) => ({
        ...old,
        isFavorite: !favorite,
      }));

      // Return a context object with the snapshotted value
      return previousValue;
    },
    onError: (error, variables, context) => {
      // Revert the optimistic update on error
      setFavorite((prev) => !prev);

      // Rollback the cache value to the previous value
      queryClient.setQueryData(["highline", id], context);
    },
  });

  const outlineStyle = useAnimatedStyle(() => {
    return {
      transform: [
        {
          scale: interpolate(liked.value, [0, 1], [1, 0], Extrapolation.CLAMP),
        },
      ],
    };
  });

  const fillStyle = useAnimatedStyle(() => {
    return {
      transform: [
        {
          scale: liked.value,
        },
      ],
    };
  });

  return (
    <Pressable
      className="flex p-2 rounded-full bg-white"
      onPress={() => mutate()}
    >
      <Animated.View
        className="items-center justify-center "
        style={[StyleSheet.absoluteFillObject, outlineStyle]}
      >
        <LucideIcon name="Heart" className="size-6 text-black" />
      </Animated.View>

      <Animated.View className="items-center justify-center" style={fillStyle}>
        <LucideIcon name="Heart" className="size-6 text-red-500 fill-red-500" />
      </Animated.View>
    </Pressable>
  );
}
