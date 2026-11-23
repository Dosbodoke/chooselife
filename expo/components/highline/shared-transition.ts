import { FadeInDown, SharedTransition } from 'react-native-reanimated';

// Opening a highline from the Explore list flies the card's photo into the
// cover and its name onto it, while the rest of the screen fades and the
// content sheet rises in under them.

export const highlineImageTag = (highlineID: string) =>
  `highline-image-${highlineID}`;

export const highlineNameTag = (highlineID: string) =>
  `highline-name-${highlineID}`;

/**
 * A light spring that overshoots a little, so the photo lands with a bounce.
 * The name uses it too, to stay on the photo while both fly.
 */
export const highlineTransition =
  SharedTransition.springify(450).dampingRatio(0.75);

/** The content sheet rises in as the photo lands. */
export const highlineContentEntering = FadeInDown.duration(350).delay(100);
