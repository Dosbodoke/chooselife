/**
 * PROTOTYPE: three variants of the home widget, switchable via `?variant=`
 * on the existing home tab, plus the current widget ("Now") for comparison.
 * Throwaway. Fold the winner into `components/widget.tsx`, then drop this
 * folder and the switcher from the home screen.
 */
import FestivalImage from '~/assets/images/festival.webp';
import HighlineWalkImage from '~/assets/images/highline-walk.webp';
import type { Href, useRouter } from 'expo-router';
import React from 'react';

import { Widget, WIDGET_HERO_BASE_HEIGHT } from '~/components/widget';

import type { PromoItem } from './types';
import { STORY_HERO_BASE_HEIGHT, StoryHero } from './variant-a-story-hero';
import { PeekCards } from './variant-b-peek-cards';
import { CompactList } from './variant-c-compact-list';

export type { PromoItem } from './types';

export const HOME_WIDGET_VARIANTS = [
  { key: 'A', name: 'Story hero' },
  { key: 'B', name: 'Peek cards' },
  { key: 'C', name: 'Compact list' },
  { key: 'Now', name: 'Current widget' },
] as const;

export type HomeWidgetVariant = (typeof HOME_WIDGET_VARIANTS)[number]['key'];

/**
 * How each variant meets the status bar. `heroHeight` is the dark area the
 * light status bar sits on (0 = none); `dynamic` follows the active slide.
 */
export const HOME_WIDGET_META: Record<
  HomeWidgetVariant,
  { heroHeight: number; statusBarAtTop: 'light' | 'dark' | 'dynamic' }
> = {
  A: { heroHeight: STORY_HERO_BASE_HEIGHT, statusBarAtTop: 'dynamic' },
  B: { heroHeight: 0, statusBarAtTop: 'dark' },
  C: { heroHeight: 0, statusBarAtTop: 'dark' },
  Now: { heroHeight: WIDGET_HERO_BASE_HEIGHT, statusBarAtTop: 'light' },
};

/**
 * PROTOTYPE sample data. Production has a single promo, which hides how
 * each variant handles several, so two placeholder promos ride along.
 */
export const prototypeSampleItems = (router: ReturnType<typeof useRouter>): PromoItem[] => [
  {
    id: 'prototype-festival',
    eyebrow: 'Eventos',
    title: 'Festivais de highline',
    subtitle: 'Veja os próximos encontros perto de você',
    cta: 'Ver eventos',
    image: FestivalImage,
    kind: 'photo',
    onPress: () => router.push('/events'),
  },
  {
    id: 'prototype-learn',
    eyebrow: 'Guia',
    title: 'Aprenda highline',
    subtitle: 'Do primeiro passo à primeira travessia',
    cta: 'Começar',
    image: HighlineWalkImage,
    kind: 'photo',
    onPress: () => router.push('/learn' as Href),
  },
];

export function HomeWidgetPrototype({
  variant,
  items,
  onStatusBarChange,
}: {
  variant: HomeWidgetVariant;
  items: PromoItem[];
  onStatusBarChange: (style: 'light' | 'dark') => void;
}) {
  switch (variant) {
    case 'A':
      return <StoryHero items={items} onStatusBarChange={onStatusBarChange} />;
    case 'B':
      return <PeekCards items={items} />;
    case 'C':
      return <CompactList items={items} />;
    case 'Now':
      return (
        <Widget
          items={items.map((item) => ({
            id: item.id,
            title: item.title,
            subtitle: item.subtitle,
            background: item.image,
            onPress: item.onPress,
          }))}
        />
      );
  }
}
