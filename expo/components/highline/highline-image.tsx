import ChooselifeBlackImage from '~/assets/images/chooselife_black.png';
import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { supabase } from '~/lib/supabase';
import { cn } from '~/lib/utils';

export const HighlineImage: React.FC<{
  coverImageId: string | null;
  className?: string;
  dotSize?: 'default' | 'small';
}> = ({ coverImageId, className, dotSize = 'default' }) => {
  const [loaded, setLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);

  // Removed the useEffect for resetting state on coverImageId change,
  // as onLoadStart will handle it more dynamically.
  // Removed the useEffect for the 5-second timeout.

  if (!coverImageId || hasError) {
    return (
      <View
        className={cn(
          'bg-muted items-center justify-center w-full h-full',
          className,
        )}
      >
        <Image
          source={ChooselifeBlackImage}
          alt="Chooselife"
          contentFit="contain"
          style={{ width: '100%', height: '100%' }}
          className="w-full h-full"
        />
      </View>
    );
  }

  const {
    data: { publicUrl: URL },
  } = supabase.storage.from('images').getPublicUrl(`${coverImageId}`);

  return (
    <View className={cn('bg-muted relative overflow-hidden', className)}>
      {!loaded && ( // Still show loading dots if not loaded yet
        <View className="absolute inset-0 items-center justify-center">
          <LoadingDots dotSize={dotSize} />
        </View>
      )}
      <Image
        source={{ uri: URL, cacheKey: coverImageId }}
        cachePolicy="memory-disk"
        contentFit="cover"
        alt="Image of the Highline"
        onLoadStart={() => { // Added onLoadStart to reset state
          setLoaded(false);
          setHasError(false);
        }}
        onLoad={() => {
          setLoaded(true);
        }}
        onError={(e) => {
          setHasError(true);
        }}
        style={{ width: '100%', height: '100%' }}
        className={cn(className)}
        transition={200}
      />
    </View>
  );
};

const LoadingDots: React.FC<{ dotSize?: 'default' | 'small' }> = ({
  dotSize,
}) => {
  // Individual shared values for each dot
  const dot1Progress = useSharedValue(0);
  const dot2Progress = useSharedValue(0);
  const dot3Progress = useSharedValue(0);

  useEffect(() => {
    const pulse = withTiming(1, {
      duration: 2000,
      easing: Easing.inOut(Easing.cubic),
    });
    dot1Progress.value = withRepeat(pulse, -1, true);
    dot2Progress.value = withDelay(300, withRepeat(pulse, -1, true));
    dot3Progress.value = withDelay(600, withRepeat(pulse, -1, true));
  }, []);

  const createDotStyle = (progress: SharedValue<number>) =>
    useAnimatedStyle(() => ({
      opacity: interpolate(
        progress.value,
        [0, 0.1, 0.3, 0.7, 1],
        [1, 0.8, 0.5, 0.8, 1],
      ),
      transform: [
        {
          translateY: interpolate(progress.value, [0, 1], [0, -12]),
        },
      ],
    }));

  const dot1 = createDotStyle(dot1Progress);
  const dot2 = createDotStyle(dot1Progress); // Use dot1Progress to avoid unnecessary animation
  const dot3 = createDotStyle(dot1Progress); // Use dot1Progress to avoid unnecessary animation

  return (
    <View
      className={cn(
        'flex-row w-full h-full items-center justify-center opacity-70',
        dotSize === 'default' ? 'gap-3' : 'gap-2',
      )}
    >
      <Animated.View
        className={cn(
          'rounded-full bg-muted-foreground',
          dotSize === 'default' ? 'size-6' : 'size-3',
        )}
        style={[dot1]}
      />
      <Animated.View
        className={cn(
          'rounded-full bg-muted-foreground',
          dotSize === 'default' ? 'size-6' : 'size-3',
        )}
        style={[dot2]}
      />
      <Animated.View
        className={cn(
          'rounded-full bg-muted-foreground',
          dotSize === 'default' ? 'size-6' : 'size-3',
        )}
        style={[dot3]}
      />
    </View>
  );
};
