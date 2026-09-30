import * as Haptics from 'expo-haptics';
import React from 'react';
import {
  ActivityIndicator,
  Platform,
  RefreshControl,
  View,
} from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedProps,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';
import { scheduleOnRN } from 'react-native-worklets';

import { HighlineImage } from '~/components/highline/highline-image';
import { BlurView } from '~/components/ui/backdrop';

export const COVER_HEIGHT = 320;
/** How far the content sheet overlaps the bottom of the cover. */
export const SHEET_OVERLAP = 24;
/** Overscroll distance past which releasing triggers a refresh. */
const PULL_THRESHOLD = 90;

/**
 * Cover image pinned behind the scroll view. On overscroll it scales up with
 * its bottom edge fixed to the content sheet and its top pinned to the screen;
 * on normal scroll it drifts away at half speed.
 */
export const HighlineCover: React.FC<{
  coverImageId: string | null;
  scrollY: SharedValue<number>;
}> = ({ coverImageId, scrollY }) => {
  const style = useAnimatedStyle(() => {
    const y = scrollY.value;
    if (y < 0) {
      return {
        transform: [{ translateY: -y / 2 }, { scale: 1 - y / COVER_HEIGHT }],
      };
    }
    return { transform: [{ translateY: -y * 0.5 }] };
  });

  return (
    <Animated.View
      className="absolute top-0 left-0 right-0"
      style={[{ height: COVER_HEIGHT }, style]}
    >
      <HighlineImage coverImageId={coverImageId} className="w-full h-full" />
    </Animated.View>
  );
};

/**
 * Pull-to-refresh driven by overscroll, so the indicator can sit on the cover
 * image. `RefreshControl` never fired on this Reanimated scroll view on iOS,
 * and its spinner would be hidden behind the stretched cover anyway.
 *
 * Android has no overscroll, so it keeps the native `RefreshControl`.
 */
export const usePullToRefresh = ({
  refreshing,
  onRefresh,
}: {
  refreshing: boolean;
  onRefresh: () => void;
}) => {
  const insets = useSafeAreaInsets();
  const scrollY = useSharedValue(0);
  const armed = useSharedValue(false);

  const haptic = () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (e) => {
      scrollY.value = e.contentOffset.y;
      const past = e.contentOffset.y < -PULL_THRESHOLD;
      if (past !== armed.value) {
        armed.value = past;
        if (past) scheduleOnRN(haptic);
      }
    },
    onEndDrag: (e) => {
      if (e.contentOffset.y < -PULL_THRESHOLD) scheduleOnRN(onRefresh);
    },
  });

  const refreshControl =
    Platform.OS === 'android' ? (
      <RefreshControl
        refreshing={refreshing}
        onRefresh={onRefresh}
        progressViewOffset={insets.top}
      />
    ) : undefined;

  return { scrollY, scrollHandler, refreshControl };
};

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const RING_SIZE = 40;
const RING = 30;
const RING_R = 12;
const RING_C = 2 * Math.PI * RING_R;

/** Fills as the user pulls; becomes a spinner while refreshing. iOS only. */
export const PullToRefreshRing: React.FC<{
  scrollY: SharedValue<number>;
  refreshing: boolean;
  top: number;
}> = ({ scrollY, refreshing, top }) => {
  const containerStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      scrollY.value,
      [-PULL_THRESHOLD * 0.3, -PULL_THRESHOLD * 0.6],
      [0, 1],
      Extrapolation.CLAMP,
    ),
    transform: [
      {
        scale: interpolate(
          scrollY.value,
          [-PULL_THRESHOLD, -PULL_THRESHOLD - 20],
          [1, 1.15],
          Extrapolation.CLAMP,
        ),
      },
    ],
  }));

  const ringProps = useAnimatedProps(() => ({
    strokeDashoffset:
      RING_C *
      (1 -
        interpolate(
          -scrollY.value,
          [PULL_THRESHOLD * 0.3, PULL_THRESHOLD],
          [0, 1],
          Extrapolation.CLAMP,
        )),
  }));

  if (Platform.OS === 'android') return null;

  return (
    <View
      pointerEvents="none"
      className="absolute left-0 right-0 items-center"
      style={{ top }}
    >
      <Animated.View style={refreshing ? undefined : containerStyle}>
        <BlurView
          intensity={60}
          tint="systemThinMaterialDark"
          cornerRadius={RING_SIZE / 2}
          style={{ width: RING_SIZE, height: RING_SIZE }}
        >
          <View className="flex-1 items-center justify-center">
            {refreshing ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Svg width={RING} height={RING}>
                <Circle
                  cx={RING / 2}
                  cy={RING / 2}
                  r={RING_R}
                  stroke="rgba(255,255,255,0.3)"
                  strokeWidth={3}
                  fill="none"
                />
                <AnimatedCircle
                  cx={RING / 2}
                  cy={RING / 2}
                  r={RING_R}
                  stroke="#fff"
                  strokeWidth={3}
                  strokeLinecap="round"
                  fill="none"
                  strokeDasharray={RING_C}
                  animatedProps={ringProps}
                  transform={`rotate(-90 ${RING / 2} ${RING / 2})`}
                />
              </Svg>
            )}
          </View>
        </BlurView>
      </Animated.View>
    </View>
  );
};
