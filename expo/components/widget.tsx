import { Image, type ImageSource } from 'expo-image';
import { useFocusEffect } from 'expo-router';
import { ArrowRightIcon } from 'lucide-react-native';
import React, { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type AccessibilityActionEvent,
} from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  FadeIn,
  FadeInDown,
  FadeOut,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';

import { useMountEffect } from '~/hooks/use-mount-effect';

import { Icon } from '~/components/ui/icon';

export const WIDGET_HERO_BASE_HEIGHT = 400;
const SLIDE_MS = 6000;
/** Share of the width, from the left, that goes back a slide on tap. */
const PREVIOUS_ZONE = 0.3;

export type WidgetItem = {
  id: string;
  eyebrow: string;
  title: string;
  subtitle?: string;
  cta: string;
  image: string | ImageSource;
  /**
   * `photo` fills the slide and can be cropped. `brand` is a transparent
   * mark (stamp, logo) set as a tilted watermark on a dark `surface`.
   */
  kind: 'photo' | 'brand';
  /** Brand only: slide background. */
  surface?: string;
  /** Brand only: colour of the soft glow in the top-right corner. */
  glow?: string;
  onPress?: () => void;
};

/**
 * Home hero. Shows one promo at a time, full bleed, with white copy and a
 * pill button. With several promos it auto-advances like a story: tap the
 * right side for next, the left side for previous, hold to pause.
 */
export function Widget({ items }: { items: WidgetItem[] }) {
  const { t } = useTranslation();
  const { top } = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const height = WIDGET_HERO_BASE_HEIGHT + top;
  const [index, setIndex] = useState(0);
  const indexRef = useRef(0);
  const active = useSharedValue(0);
  const progress = useSharedValue(0);
  const hasMany = items.length > 1;
  const item = items[index % items.length];

  const play = (from: number) => {
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
    play(0);
  }

  // Only run the timer while home is the visible tab.
  useFocusEffect(
    React.useCallback(() => {
      play(progress.value < 1 ? progress.value : 0);
      return () => cancelAnimation(progress);
    }, [hasMany]),
  );

  if (!item) return null;

  const onTap = (x: number) => {
    if (!hasMany) return item.onPress?.();
    goTo(indexRef.current + (x < width * PREVIOUS_ZONE ? -1 : 1));
  };

  const onAccessibilityAction = (event: AccessibilityActionEvent) => {
    if (event.nativeEvent.actionName === 'increment')
      goTo(indexRef.current + 1);
    if (event.nativeEvent.actionName === 'decrement')
      goTo(indexRef.current - 1);
  };

  return (
    <View style={{ height }} className="overflow-hidden bg-black">
      <Animated.View
        key={item.id}
        entering={FadeIn.duration(450)}
        exiting={FadeOut.duration(450)}
        style={StyleSheet.absoluteFill}
      >
        <SlideBackground item={item} top={top} />
      </Animated.View>

      {/* Tap zones sit under the copy; the copy lets touches fall through. */}
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={(e) => onTap(e.nativeEvent.locationX)}
        onPressIn={() => cancelAnimation(progress)}
        onPressOut={() => play(progress.value)}
        onLongPress={() => {}}
        delayLongPress={220}
        accessibilityLabel={item.title}
        {...(hasMany
          ? {
              accessibilityRole: 'adjustable' as const,
              accessibilityHint: t('app.(tabs).home.widget.nextHint'),
              accessibilityValue: { min: 1, max: items.length, now: index + 1 },
              accessibilityActions: [
                { name: 'increment' as const },
                { name: 'decrement' as const },
              ],
              onAccessibilityAction,
            }
          : { accessibilityRole: 'button' as const })}
      />

      {hasMany ? (
        <View
          pointerEvents="none"
          className="absolute inset-x-4 flex-row gap-1"
          style={{ top: top + 8 }}
        >
          {items.map((it, i) => (
            <ProgressSegment
              key={it.id}
              index={i}
              active={active}
              progress={progress}
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
          <Text className="text-xs font-bold uppercase tracking-[2px] text-white/70">
            {item.eyebrow}
          </Text>
          <Text
            className="text-[34px] font-black leading-[38px] tracking-tight text-white"
            numberOfLines={2}
          >
            {item.title}
          </Text>
          {item.subtitle ? (
            <Text
              className="text-[15px] leading-6 text-white/80"
              style={{ maxWidth: '88%' }}
              numberOfLines={2}
            >
              {item.subtitle}
            </Text>
          ) : null}
          <Pressable
            onPress={item.onPress}
            accessibilityRole="button"
            accessibilityLabel={item.cta}
            className="mt-2 min-h-11 flex-row items-center gap-2 self-start rounded-full bg-white px-5 py-3 active:opacity-80"
          >
            <Text className="text-[15px] font-semibold text-black">
              {item.cta}
            </Text>
            <Icon
              as={ArrowRightIcon}
              size={16}
              strokeWidth={2.5}
              color="#000"
            />
          </Pressable>
        </Animated.View>
      </View>
    </View>
  );
}

function SlideBackground({ item, top }: { item: WidgetItem; top: number }) {
  const reduceMotion = useReducedMotion();
  // Slow push-in so a still image feels alive while the slide is up.
  const scale = useSharedValue(reduceMotion ? 1 : 1.08);
  useMountEffect(() => {
    if (!reduceMotion)
      scale.value = withTiming(1, { duration: SLIDE_MS + 1000 });
  });
  const zoom = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));
  const source =
    typeof item.image === 'string' ? { uri: item.image } : item.image;

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
            source={source}
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

  return (
    <>
      <Animated.View style={[StyleSheet.absoluteFill, zoom]}>
        <Image
          source={source}
          style={{ flex: 1 }}
          contentFit="cover"
          cachePolicy="disk"
        />
      </Animated.View>
      {/* Keeps the status bar and progress bars readable on bright photos. */}
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

function ProgressSegment({
  index,
  active,
  progress,
}: {
  index: number;
  active: SharedValue<number>;
  progress: SharedValue<number>;
}) {
  const fill = useAnimatedStyle(() => {
    const amount =
      index < active.value ? 1 : index === active.value ? progress.value : 0;
    return { width: `${amount * 100}%` };
  });

  return (
    <View className="h-[3px] flex-1 overflow-hidden rounded-full bg-white/35">
      <Animated.View className="h-full rounded-full bg-white" style={fill} />
    </View>
  );
}
