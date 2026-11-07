/**
 * PROTOTYPE variant A, "Story hero": one full-bleed slide at a time,
 * auto-advancing like a story. Tap the right side for next, the left for
 * previous, hold to pause. A compact pill opens the promo.
 */
import { Image } from 'expo-image';
import { ArrowRightIcon } from 'lucide-react-native';
import React, { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  FadeIn,
  FadeInDown,
  FadeOut,
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';

import { useMountEffect } from '~/hooks/use-mount-effect';

import { Icon } from '~/components/ui/icon';

import { imageSource, type PromoItem } from './types';

export const STORY_HERO_BASE_HEIGHT = 400;
const SLIDE_MS = 6000;

/** Status bar style that stays legible on top of the slide. */
const statusBarFor = (item: PromoItem) =>
  item.kind === 'artwork' ? 'dark' : 'light';

export function StoryHero({
  items,
  onStatusBarChange,
}: {
  items: PromoItem[];
  onStatusBarChange?: (style: 'light' | 'dark') => void;
}) {
  const { top } = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const height = STORY_HERO_BASE_HEIGHT + top;
  const [index, setIndex] = useState(0);
  const indexRef = useRef(0);
  const active = useSharedValue(0);
  const progress = useSharedValue(0);
  const hasMany = items.length > 1;

  const item = items[index];
  const isArtwork = item.kind === 'artwork';

  const run = (from: number) => {
    if (!hasMany) return;
    progress.value = from;
    progress.value = withTiming(
      1,
      { duration: SLIDE_MS * (1 - from), easing: Easing.linear },
      (finished) => {
        if (finished) scheduleOnRN(goTo, indexRef.current + 1);
      },
    );
  };

  function goTo(next: number) {
    const i = (next + items.length) % items.length;
    indexRef.current = i;
    active.value = i;
    setIndex(i);
    onStatusBarChange?.(statusBarFor(items[i]));
    run(0);
  }

  useMountEffect(() => {
    onStatusBarChange?.(statusBarFor(items[0]));
    run(0);
    return () => cancelAnimation(progress);
  });

  const onTap = (x: number) => {
    if (!hasMany) return item.onPress?.();
    goTo(indexRef.current + (x < width * 0.3 ? -1 : 1));
  };

  const fg = isArtwork ? '#0a0a0a' : '#ffffff';

  return (
    <View style={{ height }} className="overflow-hidden bg-black">
      <Animated.View
        key={item.id}
        entering={FadeIn.duration(450)}
        exiting={FadeOut.duration(450)}
        style={StyleSheet.absoluteFill}
      >
        <SlideBackground item={item} top={top} height={height} />
      </Animated.View>

      {/* Tap zones sit under the copy; the copy lets touches fall through. */}
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={(e) => onTap(e.nativeEvent.locationX)}
        onPressIn={() => cancelAnimation(progress)}
        onPressOut={() => run(progress.value)}
        onLongPress={() => {}}
        delayLongPress={220}
        accessibilityRole="button"
        accessibilityLabel={item.title}
        accessibilityHint={hasMany ? 'Toque para o próximo destaque' : item.cta}
      />

      {hasMany ? (
        <View
          pointerEvents="none"
          className="absolute inset-x-4 flex-row gap-1"
          style={{ top: top + 8 }}
        >
          {items.map((it, i) => (
            <Segment
              key={it.id}
              index={i}
              active={active}
              progress={progress}
              dark={isArtwork}
            />
          ))}
        </View>
      ) : null}

      <View
        pointerEvents="box-none"
        className="absolute inset-x-0 bottom-0 px-5 pb-6"
      >
        <Animated.View
          key={item.id}
          entering={FadeInDown.duration(450).delay(120)}
          pointerEvents="box-none"
          className="gap-2"
        >
          <Text
            className="text-xs font-bold uppercase tracking-[2px]"
            style={{ color: fg, opacity: 0.7 }}
          >
            {item.eyebrow}
          </Text>
          <Text
            className="text-[34px] font-black leading-[38px] tracking-tight"
            style={{ color: fg }}
            numberOfLines={2}
          >
            {item.title}
          </Text>
          {item.subtitle ? (
            <Text
              className="text-[15px] leading-6"
              style={{ color: fg, opacity: 0.8, maxWidth: '88%' }}
              numberOfLines={2}
            >
              {item.subtitle}
            </Text>
          ) : null}
          <Pressable
            onPress={item.onPress}
            className="mt-2 flex-row items-center gap-2 self-start rounded-full px-5 py-3 active:opacity-80"
            style={{ backgroundColor: isArtwork ? '#0a0a0a' : '#ffffff' }}
          >
            <Text
              className="text-[15px] font-semibold"
              style={{ color: isArtwork ? '#ffffff' : '#0a0a0a' }}
            >
              {item.cta}
            </Text>
            <Icon
              as={ArrowRightIcon}
              size={16}
              strokeWidth={2.5}
              color={isArtwork ? '#ffffff' : '#0a0a0a'}
            />
          </Pressable>
        </Animated.View>
      </View>
    </View>
  );
}

function SlideBackground({
  item,
  top,
  height,
}: {
  item: PromoItem;
  top: number;
  height: number;
}) {
  // Slow push-in so a still photo feels alive while the slide is up.
  const scale = useSharedValue(1.08);
  useMountEffect(() => {
    scale.value = withTiming(1, { duration: SLIDE_MS + 1000 });
  });
  const zoom = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  if (item.kind === 'brand') {
    const surface = item.surface ?? '#18181b';
    return (
      <View style={[StyleSheet.absoluteFill, { backgroundColor: surface }]}>
        {item.glow ? (
          <View
            style={[
              StyleSheet.absoluteFill,
              {
                experimental_backgroundImage: `radial-gradient(circle at 100% 0%, ${item.glow} 0%, rgba(0, 0, 0, 0) 65%)`,
              },
            ]}
          />
        ) : null}
        {/* The mark bleeds off the top-right corner, tilted like a stamp. */}
        <Animated.View
          style={[
            {
              position: 'absolute',
              top: top + 4,
              right: -56,
              width: 290,
              height: 290,
            },
            zoom,
          ]}
        >
          <Image
            source={imageSource(item.image)}
            style={{ flex: 1, opacity: 0.3, transform: [{ rotate: '14deg' }] }}
            contentFit="contain"
          />
        </Animated.View>
        {/* Fades the mark out behind the copy so the text stays legible. */}
        <View
          className="absolute inset-x-0 bottom-0"
          style={{
            height: '60%',
            experimental_backgroundImage: `linear-gradient(to top, ${surface} 35%, rgba(24, 24, 27, 0) 100%)`,
          }}
        />
      </View>
    );
  }

  if (item.kind === 'artwork') {
    return (
      <View
        style={[StyleSheet.absoluteFill, { backgroundColor: item.surface ?? '#fff' }]}
      >
        {/* Artwork has wide built-in margins; bleed it so the mark reads big. */}
        <Animated.View
          style={[
            { position: 'absolute', top: top + 8, left: -48, right: -48, height: height * 0.55 },
            zoom,
          ]}
        >
          <Image
            source={imageSource(item.image)}
            style={{ flex: 1 }}
            contentFit="contain"
          />
        </Animated.View>
      </View>
    );
  }

  return (
    <>
      <Animated.View style={[StyleSheet.absoluteFill, zoom]}>
        <Image
          source={imageSource(item.image)}
          style={{ flex: 1 }}
          contentFit="cover"
          cachePolicy="disk"
        />
      </Animated.View>
      <View
        className="absolute inset-x-0 top-0"
        style={{
          height: top + 96,
          experimental_backgroundImage:
            'linear-gradient(to bottom, rgba(0, 0, 0, 0.5) 0%, rgba(0, 0, 0, 0) 100%)',
        }}
      />
      <View
        className="absolute inset-x-0 bottom-0"
        style={{
          height: '75%',
          experimental_backgroundImage:
            'linear-gradient(to top, rgba(0, 0, 0, 0.9) 0%, rgba(0, 0, 0, 0.55) 45%, rgba(0, 0, 0, 0) 100%)',
        }}
      />
    </>
  );
}

function Segment({
  index,
  active,
  progress,
  dark,
}: {
  index: number;
  active: SharedValue<number>;
  progress: SharedValue<number>;
  dark: boolean;
}) {
  const fill = useAnimatedStyle(() => {
    const amount =
      index < active.value ? 1 : index === active.value ? progress.value : 0;
    return { width: `${amount * 100}%` };
  });

  return (
    <View
      className="h-[3px] flex-1 overflow-hidden rounded-full"
      style={{ backgroundColor: dark ? 'rgba(0,0,0,0.15)' : 'rgba(255,255,255,0.35)' }}
    >
      <Animated.View
        className="h-full rounded-full"
        style={[{ backgroundColor: dark ? '#0a0a0a' : '#ffffff' }, fill]}
      />
    </View>
  );
}
