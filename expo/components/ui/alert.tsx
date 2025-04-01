import { Text, View } from 'react-native';
import Animated, {
  FadeInDown,
  FadeOutUp,
  LinearTransition,
} from 'react-native-reanimated';

import { LucideIcon } from '~/lib/icons/lucide-icon';

export const Alert: React.FC<{ message: string }> = ({ message }) => {
  return (
    <Animated.View
      entering={FadeInDown.duration(300)}
      exiting={FadeOutUp.duration(200)}
      layout={LinearTransition.springify().damping(14)}
      className="flex-row py-3 px-2 bg-amber-500/10 border border-amber-300 rounded w-full gap-2 pt-1"
    >
      <View className="pt-2">
        <LucideIcon
          name="TriangleAlert"
          strokeWidth={1.5}
          className="text-primary size-6 "
        />
      </View>
      <Text className="flex-1 flex-wrap">{message}</Text>
    </Animated.View>
  );
};
