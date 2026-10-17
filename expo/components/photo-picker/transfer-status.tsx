import { CheckIcon, RotateCcwIcon } from 'lucide-react-native';
import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeOut, useReducedMotion } from 'react-native-reanimated';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { Icon } from '~/components/ui/icon';
import { Text } from '~/components/ui/text';

import {
  BADGE_POP,
  FADE_IN,
  FILL_FINISH,
  PULSE,
  SAVED_FADE,
  TONES,
  WIDTH_TRANSITION,
} from './motion';
import type { PhotoTransfer } from './use-photo-transfer';

const translationKey = 'components.photo-picker';

type ActiveTransfer = Exclude<
  PhotoTransfer,
  { state: 'idle' } | { state: 'saved' }
>;

/** Status band along the bottom of a cover; the photo stays visible. */
export function CoverStatus({
  transfer,
  onRetry,
}: {
  transfer: PhotoTransfer;
  onRetry?: () => void;
}) {
  if (transfer.state === 'idle') return null;
  // Separate elements: a new save always starts from a fresh, empty bar.
  return (
    <Animated.View
      exiting={FadeOut.duration(150)}
      pointerEvents="box-none"
      style={[styles.band, styles.coverBand]}
    >
      {transfer.state === 'saved' ? (
        <CoverSaved />
      ) : (
        <CoverProgress transfer={transfer} onRetry={onRetry} />
      )}
    </Animated.View>
  );
}

function CoverProgress({
  transfer,
  onRetry,
}: {
  transfer: ActiveTransfer;
  onRetry?: () => void;
}) {
  const { t } = useTranslation();
  const reduced = useReducedMotion();
  const label = useStatusLabel(transfer);
  const pulse = transfer.state === 'queued' && !reduced;

  return (
    <Animated.View pointerEvents="box-none" style={[styles.fill, FADE_IN]}>
      <Scrim />
      <View
        pointerEvents="box-none"
        className="flex-row items-center justify-between gap-3 px-3 pb-3.5"
      >
        <Animated.View style={[styles.label, pulse ? PULSE : null]}>
          <Text
            numberOfLines={2}
            accessibilityLiveRegion="polite"
            className="text-sm font-medium text-white"
            style={styles.tabular}
          >
            {label}
          </Text>
        </Animated.View>
        {transfer.state === 'failed' && onRetry ? (
          <Pressable
            accessibilityRole="button"
            onPress={onRetry}
            hitSlop={8}
            className="h-8 flex-row items-center gap-1.5 rounded-full bg-white px-3 active:bg-white/80"
          >
            <Icon as={RotateCcwIcon} className="size-3.5 text-zinc-900" />
            <Text className="text-xs font-semibold text-zinc-900">
              {t(`${translationKey}.retry`)}
            </Text>
          </Pressable>
        ) : null}
      </View>
      <ProgressTrack transfer={transfer} />
    </Animated.View>
  );
}

function CoverSaved() {
  const { t } = useTranslation();
  return (
    <Animated.View pointerEvents="none" style={[styles.fill, SAVED_FADE]}>
      <Scrim />
      <View className="flex-row items-center gap-1.5 px-3 pb-3.5">
        <Icon as={CheckIcon} className="size-4 text-emerald-300" />
        <Text className="text-sm font-medium text-white">
          {t(`${translationKey}.saved`)}
        </Text>
      </View>
      <FinishedTrack />
    </Animated.View>
  );
}

/** Bottom bar plus a center badge, sized for a list tile. */
export function TileStatus({ transfer }: { transfer: PhotoTransfer }) {
  if (transfer.state === 'idle') return null;
  return (
    <Animated.View
      exiting={FadeOut.duration(150)}
      pointerEvents="none"
      style={StyleSheet.absoluteFill}
    >
      {transfer.state === 'saved' ? (
        <Animated.View style={[styles.fill, SAVED_FADE]}>
          <View style={[styles.band, styles.tileBand]}>
            <Scrim />
          </View>
          <View style={styles.center}>
            <Animated.View style={BADGE_POP}>
              <View className="h-8 w-8 items-center justify-center rounded-full bg-emerald-500">
                <Icon as={CheckIcon} className="size-4 text-white" />
              </View>
            </Animated.View>
          </View>
          <FinishedTrack />
        </Animated.View>
      ) : (
        <Animated.View style={[styles.fill, FADE_IN]}>
          <View style={[styles.band, styles.tileBand]}>
            <Scrim />
          </View>
          {transfer.state === 'failed' ? (
            <View style={styles.center}>
              <View className="h-8 w-8 items-center justify-center rounded-full bg-white">
                <Icon as={RotateCcwIcon} className="size-4 text-zinc-900" />
              </View>
            </View>
          ) : null}
          <ProgressTrack transfer={transfer} />
        </Animated.View>
      )}
    </Animated.View>
  );
}

function useStatusLabel(transfer: ActiveTransfer) {
  const { t } = useTranslation();
  if (transfer.state === 'failed') return transfer.message;
  if (transfer.state === 'queued') return t(`${translationKey}.status.queued`);
  return t(`${translationKey}.status.${transfer.step}`, {
    percent: Math.round(transfer.progress * 100),
  });
}

function ProgressTrack({ transfer }: { transfer: ActiveTransfer }) {
  const { t } = useTranslation();
  const progress = transfer.state === 'queued' ? 0 : transfer.progress;
  const percent = Math.round(Math.min(1, Math.max(0, progress)) * 100);
  const tone = transfer.state === 'failed' ? 'failed' : 'active';
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={t(`${translationKey}.a11y.progress`)}
      accessibilityValue={{ min: 0, max: 100, now: percent }}
      style={styles.track}
    >
      {/* Keyed by tone: retrying restarts at zero instead of sliding back. */}
      <Animated.View
        key={tone}
        style={[
          styles.bar,
          { width: `${percent}%`, backgroundColor: TONES[tone] },
          WIDTH_TRANSITION,
        ]}
      />
    </View>
  );
}

function FinishedTrack() {
  return (
    <View style={styles.track}>
      <Animated.View
        style={[
          styles.bar,
          { width: '100%', backgroundColor: TONES.saved },
          FILL_FINISH,
        ]}
      />
    </View>
  );
}

/** Dark gradient so white status text reads on any photo. */
function Scrim() {
  const id = `scrim${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  return (
    <Svg
      style={StyleSheet.absoluteFill}
      preserveAspectRatio="none"
      viewBox="0 0 1 1"
    >
      <Defs>
        <LinearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#000" stopOpacity="0" />
          <Stop offset="1" stopColor="#000" stopOpacity="0.6" />
        </LinearGradient>
      </Defs>
      <Rect width="1" height="1" fill={`url(#${id})`} />
    </Svg>
  );
}

const styles = StyleSheet.create({
  band: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  coverBand: { height: 76 },
  tileBand: { height: 28 },
  fill: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    justifyContent: 'flex-end',
  },
  center: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { flexShrink: 1 },
  tabular: { fontVariant: ['tabular-nums'] },
  track: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  bar: { position: 'absolute', left: 0, top: 0, bottom: 0 },
});
