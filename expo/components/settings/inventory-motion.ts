import { Easing, type WithSpringConfig } from 'react-native-reanimated';

/**
 * Motion for My webbings, measured from a 30 fps reference recording. Values
 * marked "approx." were read off a few frames rather than fitted; see
 * expo/docs/webbing-inventory-motion.md for the clip, segments and fits.
 */

/** Rows leaving: the space below closes on this spring (fit RMSE 0.002). */
export const COLLAPSE_SPRING: WithSpringConfig = {
  stiffness: 240,
  damping: 27,
  mass: 1,
};

/** Rows returning: the space opens on this spring (fit RMSE 0.003). */
export const EXPAND_SPRING: WithSpringConfig = {
  stiffness: 290,
  damping: 30,
  mass: 1,
};

/** Leaving content fades first; the space starts closing this much later. */
export const REFLOW_DELAY = 50;

/** Leaving content: fade, a slight lift and shrink (approx.). */
export const EXIT = {
  duration: 200,
  easing: Easing.poly(1.5),
  lift: -5,
  scale: 0.97,
} as const;

/** Returning content waits for most of the reflow, then rises 4 pt. */
export const REVEAL = {
  delay: 175,
  duration: 200,
  easing: Easing.out(Easing.quad),
  rise: 4,
  /** Two frames between rows, for at most three steps. */
  stagger: 67,
  maxStaggerSteps: 3,
} as const;

/** Press: in over ~100 ms, back on a quick spring with ~10% overshoot. */
export const PRESS_IN = { duration: 100, easing: Easing.out(Easing.quad) };
export const PRESS_RELEASE_SPRING: WithSpringConfig = {
  stiffness: 1500,
  damping: 46,
  mass: 1,
};

/** Past this many rows in one toggle, collapse and expand are instant. */
export const MAX_ANIMATED_ROWS = 60;
