import { HeartIcon } from 'lucide-react-native';
import { Pressable, StyleSheet } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useDerivedValue,
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
  const { mutateAsync, isPending } = useToggleFavoriteMutation();
  const liked = useDerivedValue(() => withSpring(isFavorite ? 1 : 0));

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
    if (isPending) return;

    try {
      await mutateAsync({ id, isFavorite });
    } catch (e) {
      console.error('Failed to toggle favorite status:', e);
    }
  };

  return (
    <Pressable
      className={cn('flex p-2 rounded-full bg-black/60', className)}
      disabled={isPending}
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
