import { useEffect, useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import { useToggleFavoriteMutation } from '~/hooks/use-highline';
import { LucideIcon } from '~/lib/icons/lucide-icon';
import { cn } from '~/lib/utils';

export const FavoriteHighline: React.FC<{
  isFavorite: boolean;
  id: string;
  className?: string;
  hearthClassName?: string; // Classname for unfilled hearth
}> = ({ isFavorite, id, className, hearthClassName }) => {
  const [favorite, setFavorite] = useState(isFavorite);

  const liked = useSharedValue(isFavorite ? 1 : 0);

  useEffect(() => {
    setFavorite(isFavorite);
    liked.value = isFavorite ? 1 : 0;
  }, [isFavorite]);

  const { mutateAsync } = useToggleFavoriteMutation();

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
      className={cn('flex p-2 rounded-full bg-white', className)}
      onPress={async () => {
        // Optimistically toggle local state.
        setFavorite((prev) => !prev);
        liked.value = withSpring(liked.value ? 0 : 1);

        await mutateAsync(
          { id, isFavorite: favorite },
          {
            onError: (_error, variables) => {
              // Revert local state if mutation fails.
              setFavorite(variables.isFavorite);
              liked.value = withSpring(variables.isFavorite ? 1 : 0);
            },
          },
        );
      }}
    >
      <Animated.View
        className="items-center justify-center"
        style={[StyleSheet.absoluteFillObject, outlineStyle]}
      >
        <LucideIcon
          name="Heart"
          className={cn('size-6 text-black', hearthClassName)}
        />
      </Animated.View>

      <Animated.View className="items-center justify-center" style={fillStyle}>
        <LucideIcon name="Heart" className="size-6 text-red-500 fill-red-500" />
      </Animated.View>
    </Pressable>
  );
};
