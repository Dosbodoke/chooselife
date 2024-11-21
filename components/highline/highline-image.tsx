import { useEffect, useState } from "react";
import { Image } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withDelay,
  Easing,
  interpolate,
  type SharedValue,
} from "react-native-reanimated";

import { cn } from "~/lib/utils";
import { supabase } from "~/lib/supabase";
import { View } from "react-native";

export const HighlineImage: React.FC<{
  coverImageId: string | null;
  className?: string;
  dotSize?: "default" | "small";
}> = ({ coverImageId, className, dotSize = "default" }) => {
  const [loaded, setLoaded] = useState(false);

  if (!coverImageId) {
    return (
      <View className={cn("bg-muted", className)}>
        <Image
          source={require("~/assets/images/chooselife_black.png")}
          alt="Chooselife"
          resizeMode="contain"
          className={cn(className)}
        />
      </View>
    );
  }

  const {
    data: { publicUrl: URL },
  } = supabase.storage.from("images").getPublicUrl(`${coverImageId}`);

  return (
    <View className={cn("bg-muted", className)}>
      {!loaded ? <LoadingDots dotSize={dotSize} /> : null}
      <Image
        source={{ uri: URL }}
        resizeMode="cover"
        alt="Image of the Highline"
        onLoad={() => setLoaded(true)}
        className={cn(loaded ? "" : "opacity-0", className)}
      />
    </View>
  );
};

const LoadingDots: React.FC<{ dotSize?: "default" | "small" }> = ({
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
        [1, 0.8, 0.5, 0.8, 1]
      ),
      transform: [
        {
          translateY: interpolate(progress.value, [0, 1], [0, -12]),
        },
      ],
    }));

  const dot1 = createDotStyle(dot1Progress);
  const dot2 = createDotStyle(dot2Progress);
  const dot3 = createDotStyle(dot3Progress);

  return (
    <View
      className={cn(
        "flex-row w-full h-full items-center justify-center opacity-70",
        dotSize === "default" ? "gap-3" : "gap-2"
      )}
    >
      <Animated.View
        className={cn(
          "rounded-full bg-muted-foreground",
          dotSize === "default" ? "size-6" : "size-3"
        )}
        style={[dot1]}
      />
      <Animated.View
        className={cn(
          "rounded-full bg-muted-foreground",
          dotSize === "default" ? "size-6" : "size-3"
        )}
        style={[dot2]}
      />
      <Animated.View
        className={cn(
          "rounded-full bg-muted-foreground",
          dotSize === "default" ? "size-6" : "size-3"
        )}
        style={[dot3]}
      />
    </View>
  );
};
