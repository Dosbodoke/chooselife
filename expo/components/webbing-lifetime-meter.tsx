import { StyleSheet, View } from 'react-native';
import Animated, {
  cubicBezier,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

import { useMountEffect } from '~/hooks/use-mount-effect';
import { cn } from '~/lib/utils';

/**
 * The fill is absolute and childless, so its width moves without re-laying
 * out anything else. Both motions run on the UI thread: no per-frame JS.
 */
const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);

/** A later change, like a new rig, moves the end from wherever it is. */
const RESIZE = {
  transitionProperty: 'width',
  transitionDuration: 300,
  transitionTimingFunction: cubicBezier(0.77, 0, 0.175, 1),
} as const;

/**
 * How much of a webbing's recommended lifetime its recorded use has taken.
 * The fill is the exact share; the verdict and the day counts beside it
 * say what it means.
 */
export function WebbingLifetimeMeter({
  percentUsed,
  color,
  className,
}: {
  /** Clamped to 0–100: overuse fills the track. */
  percentUsed: number;
  color: string;
  /** The track: its height, and where it sits. */
  className?: string;
}) {
  const reduced = useReducedMotion();
  const percent = Math.max(0, Math.min(100, percentUsed));
  // Starts hidden, so the first frame never shows the fill at its end.
  const shown = useSharedValue(0);
  useMountEffect(() => {
    // Once, on first appearance, the fill slides in from the start of the
    // track and stops at the share used: a transform, so it never fights the
    // width transition. The short delay lets a pushed screen settle first.
    // With reduced motion there is no travel; the fill just fades in.
    shown.set(
      reduced
        ? withTiming(1, { duration: 200, easing: EASE_OUT })
        : withDelay(120, withTiming(1, { duration: 600, easing: EASE_OUT })),
    );
  });
  const revealStyle = useAnimatedStyle(() =>
    reduced
      ? { opacity: shown.get() }
      : { transform: [{ translateX: `${(shown.get() - 1) * 100}%` }] },
  );

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(percent) }}
      className={cn('overflow-hidden rounded-full bg-slate-100', className)}
    >
      <Animated.View
        style={[
          styles.fill,
          { width: `${percent}%`, backgroundColor: color },
          revealStyle,
          reduced ? null : RESIZE,
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    borderRadius: 9999,
  },
});
