import { cubicBezier } from 'react-native-reanimated';

/**
 * Upload feedback only animates opacity and the width of an absolute,
 * childless progress fill, as Reanimated CSS transitions and keyframes:
 * no effects and no per-frame JS.
 */
const EASE_OUT = cubicBezier(0.23, 1, 0.32, 1);

export const TONES = {
  active: '#ffffff',
  saved: '#34d399',
  failed: '#f87171',
};

export const FADE_IN = {
  animationName: { from: { opacity: 0 }, to: { opacity: 1 } },
  animationDuration: 200,
  animationTimingFunction: EASE_OUT,
};

/** Hold the confirmation, then get out of the way on its own. */
export const SAVED_FADE = {
  animationName: {
    '0%': { opacity: 1 },
    '65%': { opacity: 1 },
    '100%': { opacity: 0 },
  },
  animationDuration: 1600,
  animationFillMode: 'forwards',
} as const;

export const BADGE_POP = {
  animationName: {
    '0%': { opacity: 0, transform: [{ scale: 0.9 }] },
    '15%': { opacity: 1, transform: [{ scale: 1 }] },
    '70%': { opacity: 1, transform: [{ scale: 1 }] },
    '100%': { opacity: 0, transform: [{ scale: 1 }] },
  },
  animationDuration: 1600,
  animationFillMode: 'forwards',
} as const;

export const FILL_FINISH = {
  animationName: { from: { width: '94%' }, to: { width: '100%' } },
  animationDuration: 200,
  animationTimingFunction: EASE_OUT,
} as const;

export const PULSE = {
  animationName: { from: { opacity: 0.55 }, to: { opacity: 1 } },
  animationDuration: 900,
  animationIterationCount: 'infinite',
  animationDirection: 'alternate',
} as const;

export const OPACITY_TRANSITION = {
  transitionProperty: 'opacity',
  transitionDuration: 180,
  transitionTimingFunction: EASE_OUT,
} as const;

/** Progress is constant motion: linear, and short enough to never lag. */
export const WIDTH_TRANSITION = {
  transitionProperty: 'width',
  transitionDuration: 240,
  transitionTimingFunction: 'linear',
} as const;
