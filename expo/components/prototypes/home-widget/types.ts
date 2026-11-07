import type { ImageSource } from 'expo-image';

/** PROTOTYPE: the promo item shape every home-widget variant renders. */
export type PromoItem = {
  id: string;
  eyebrow: string;
  title: string;
  subtitle?: string;
  cta: string;
  image: string | ImageSource;
  /**
   * `photo` can be cropped freely. `artwork` is a logo or poster on its own
   * flat background, so it's shown whole on `surface` instead of cropped.
   * `brand` is a transparent mark (stamp, logo) set as a big decoration on a
   * dark `surface` with a `glow`, like the SLAC cards on the org screens.
   */
  kind: 'photo' | 'artwork' | 'brand';
  /** Background behind artwork (light) or a brand mark (dark). */
  surface?: string;
  /** Brand only: CSS colour of the soft radial glow in the top corner. */
  glow?: string;
  onPress?: () => void;
};

export const imageSource = (image: PromoItem['image']) =>
  typeof image === 'string' ? { uri: image } : image;
