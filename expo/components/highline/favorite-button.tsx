import { HeartIcon } from 'lucide-react-native';
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
import { cn } from '~/lib/utils';

import { Icon } from '~/components/ui/icon';

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

  const handlePress = async () => {
    const nextFavorite = !favorite;
    const nextValue = nextFavorite ? 1 : 0;

    // Perform optimistic updates before any async gaps
    setFavorite(nextFavorite);
    liked.value = withSpring(nextValue);

    try {
      await mutateAsync(
        { id, isFavorite: favorite },
        {
          onError: (_error, variables) => {
            // Revert local state if mutation fails.
            const revertValue = variables.isFavorite ? 1 : 0;
            setFavorite(variables.isFavorite);
            liked.value = withSpring(revertValue);
          },
        },
      );
    } catch (e) {
      console.error('Failed to toggle favorite status:', e);
    }
  };

  return (
    <Pressable
      className={cn('flex p-2 rounded-full bg-black/60', className)}
      onPress={handlePress}
    >
      <Animated.View
        className="items-center justify-center"
        style={[StyleSheet.absoluteFillObject, outlineStyle]}
      >
        <Icon
          as={HeartIcon}
          className={cn('size-6 text-white', hearthClassName)}
        />
      </Animated.View>

      <Animated.View className="items-center justify-center" style={fillStyle}>
        <Icon as={HeartIcon} className="size-6 text-red-500 fill-red-500" />
      </Animated.View>
    </Pressable>
  );
};
