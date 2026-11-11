import { useState, type ReactNode } from 'react';
import { StyleSheet, type LayoutChangeEvent } from 'react-native';
import Animated, {
  useAnimatedReaction,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import {
  COLLAPSE_SPRING,
  EXIT,
  EXPAND_SPRING,
  REFLOW_DELAY,
  REVEAL,
} from './inventory-motion';

/**
 * Content that leaves and returns without unmounting, so whatever state it
 * holds (a photo save, a measured layout) survives.
 *
 * When `animate` is set, leaving fades the content in place while the space
 * it took closes on a spring, and everything below follows. Returning opens
 * the space first, then fades the content in. Otherwise, and with Reduce
 * Motion, it simply shows or hides.
 *
 * Hidden content takes no touches and is hidden from assistive technology at
 * once; it leaves the layout when its space has closed.
 */
export function InventoryReveal({
  hidden,
  animate,
  order = 0,
  className,
  children,
}: {
  hidden: boolean;
  /** Whether this change came from the owner toggling it. */
  animate: boolean;
  /** Position among content returning together, for a short stagger. */
  order?: number;
  /** Styles the content. Pad rather than margin: the space takes its height. */
  className?: string;
  children: ReactNode;
}) {
  const reduced = useReducedMotion();
  const motion = animate && !reduced;
  // Out of the layout. Lags `hidden` only while the space is animating.
  const [gone, setGone] = useState(hidden);
  if (!motion && gone !== hidden) setGone(hidden);

  // Both rest at 1. Only an animated change moves them, so an instant one
  // never shows a half-open row.
  const open = useSharedValue(1);
  const shown = useSharedValue(1);
  const contentHeight = useSharedValue(0);

  useAnimatedReaction(
    () => ({ hidden, gone, motion, measured: contentHeight.get() > 0 }),
    (current, previous) => {
      if (!previous) return;
      const changed =
        current.hidden !== previous.hidden ||
        current.gone !== previous.gone ||
        current.motion !== previous.motion;
      // Content first laid out on its way back: its space can open now.
      const sized = current.measured && !previous.measured && open.get() < 1;
      if (!changed && !sized) return;
      if (!motion || (current.gone && current.hidden)) {
        open.set(1);
        shown.set(1);
        return;
      }
      if (current.gone) {
        // Returning from out of the layout: start closed, then come back in.
        open.set(0);
        shown.set(0);
        scheduleOnRN(setGone, false);
        return;
      }
      if (current.hidden) {
        shown.set(
          withTiming(0, { duration: EXIT.duration, easing: EXIT.easing }),
        );
        open.set(
          withDelay(
            REFLOW_DELAY,
            withSpring(0, COLLAPSE_SPRING, (finished) => {
              if (finished) scheduleOnRN(setGone, true);
            }),
          ),
        );
        return;
      }
      // Never laid out yet: wait for its size rather than open onto nothing.
      if (!current.measured) return;
      open.set(withSpring(1, EXPAND_SPRING));
      // Caught on its way out, it turns straight back.
      const delay =
        shown.get() > 0
          ? 0
          : REVEAL.delay +
            Math.min(order, REVEAL.maxStaggerSteps) * REVEAL.stagger;
      shown.set(
        withDelay(
          delay,
          withTiming(1, { duration: REVEAL.duration, easing: REVEAL.easing }),
        ),
      );
    },
  );

  const spaceStyle = useAnimatedStyle(() => {
    const progress = open.get();
    return {
      height:
        progress === 1 ? 'auto' : contentHeight.get() * Math.max(progress, 0),
    };
  });
  const contentStyle = useAnimatedStyle(() => {
    const away = 1 - shown.get();
    return {
      // Out of the flow while its space animates, so it keeps its own height
      // instead of being squeezed into the space; back in the flow at rest.
      position: open.get() === 1 ? 'relative' : 'absolute',
      opacity: shown.get(),
      transform: hidden
        ? [
            { translateY: away * EXIT.lift },
            { scale: 1 - away * (1 - EXIT.scale) },
          ]
        : [{ translateY: away * REVEAL.rise }, { scale: 1 }],
    };
  });

  return (
    <Animated.View
      style={[styles.space, spaceStyle]}
      className={gone ? 'hidden' : undefined}
      pointerEvents={hidden ? 'none' : 'auto'}
      accessibilityElementsHidden={hidden}
      importantForAccessibility={hidden ? 'no-hide-descendants' : 'auto'}
    >
      {/* Keep fading text inside its shrinking space as the next group moves. */}
      <Animated.View
        style={[styles.content, contentStyle]}
        className={className}
        onLayout={({ nativeEvent: { layout } }: LayoutChangeEvent) => {
          // Leaving the layout reports no height; keep the last real one.
          if (layout.height > 0) contentHeight.set(layout.height);
        }}
      >
        {children}
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  space: { overflow: 'hidden' },
  content: { top: 0, left: 0, right: 0 },
});
