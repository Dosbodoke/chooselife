import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetView,
  type BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet';
import { useTabBarStore } from '~/store/tab-bar-store';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { LogOutIcon } from 'lucide-react-native';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useMountEffect } from '~/hooks/use-mount-effect';

import { Button } from '~/components/ui/button';
import { Icon } from '~/components/ui/icon';
import { Text } from '~/components/ui/text';

const SHEET_RADIUS = 36;
const BACKDROP_OPACITY = 0.25;

const ICON_SIZE = 64;
/** How far below its resting place the icon starts, so it trails the sheet. */
const ICON_RISE = 140;
// Slightly underdamped: the coin overshoots its turn and settles back.
const ICON_SPRING = { duration: 800, dampingRatio: 0.68 };
const ICON_DELAY = 40;

const CONTENT_TIMING = {
  duration: 560,
  easing: Easing.bezier(0.22, 1, 0.36, 1),
};
const CONTENT_DELAY = 160;
/** Share of the content timeline each row waits behind the one above it. */
const CONTENT_STAGGER = 0.12;
const CONTENT_DRIFT = 10;
const BLUR_INTENSITY = 40;

const AnimatedBlurView = Animated.createAnimatedComponent(BlurView);

type SignOutSheetProps = {
  ref: React.RefObject<BottomSheetModal | null>;
  /** Runs once the sheet has fully left, so signing out never cuts it off. */
  onConfirm: () => void;
};

/**
 * Asks before signing out. The sheet rises with the floating tab bar sinking
 * out of its way; the icon trails it up and lands with a coin flip, then the
 * copy and actions resolve out of a blur.
 */
export function SignOutSheet({ ref, onConfirm }: SignOutSheetProps) {
  const { t } = useTranslation();
  const { bottom } = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const setTabBarHidden = useTabBarStore((s) => s.setHidden);

  const iconProgress = useSharedValue(0);
  const contentProgress = useSharedValue(0);
  const isConfirmed = React.useRef(false);

  // A sheet left open by an unmount must not strand the tab bar off-screen.
  useMountEffect(() => () => setTabBarHidden(false));

  const handleAnimate = (_fromIndex: number, toIndex: number) => {
    if (toIndex === -1) {
      setTabBarHidden(false);
      return;
    }

    setTabBarHidden(true);
    if (reduceMotion) {
      iconProgress.set(1);
      contentProgress.set(withTiming(1, { duration: 200 }));
      return;
    }
    iconProgress.set(withDelay(ICON_DELAY, withSpring(1, ICON_SPRING)));
    contentProgress.set(
      withDelay(CONTENT_DELAY, withTiming(1, CONTENT_TIMING)),
    );
  };

  // Content rides the sheet down untouched; it only rewinds once off-screen.
  const handleDismiss = () => {
    iconProgress.set(0);
    contentProgress.set(0);
    if (!isConfirmed.current) return;

    isConfirmed.current = false;
    onConfirm();
  };

  const dismiss = () => ref.current?.dismiss();

  const handleConfirm = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    isConfirmed.current = true;
    dismiss();
  };

  const renderBackdrop = React.useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        opacity={BACKDROP_OPACITY}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
      />
    ),
    [],
  );

  return (
    <BottomSheetModal
      ref={ref}
      backdropComponent={renderBackdrop}
      handleComponent={null}
      backgroundStyle={{ borderRadius: SHEET_RADIUS }}
      enablePanDownToClose
      onAnimate={handleAnimate}
      onDismiss={handleDismiss}
    >
      <BottomSheetView
        className="items-center px-6 pt-8"
        style={{ paddingBottom: bottom + 8 }}
      >
        <SignOutIcon progress={iconProgress} />

        <View className="w-full items-center mt-5">
          <Reveal progress={contentProgress} index={0}>
            <Text className="text-xl font-semibold text-center">
              {t('app.(tabs).settings.signOutSheet.title')}
            </Text>
          </Reveal>
          <Reveal progress={contentProgress} index={1}>
            <Text className="mt-1.5 text-sm leading-5 text-center text-muted-foreground">
              {t('app.(tabs).settings.signOutSheet.description')}
            </Text>
          </Reveal>
          <Reveal progress={contentProgress} index={2}>
            <Button
              variant="destructive"
              className="w-full h-12 mt-6 rounded-2xl"
              onPress={handleConfirm}
              testID="sign-out-confirm"
            >
              <Text className="text-base font-semibold">
                {t('app.(tabs).settings.signOutSheet.confirm')}
              </Text>
            </Button>
          </Reveal>
          <Reveal progress={contentProgress} index={3}>
            <Button
              variant="ghost"
              className="w-full h-12 mt-1 rounded-2xl"
              onPress={dismiss}
            >
              <Text className="text-base">
                {t('app.(tabs).settings.signOutSheet.cancel')}
              </Text>
            </Button>
          </Reveal>

          {/* `filter: blur()` needs a feature flag on iOS, so a blur layer over
              the copy dissolves instead. Android just gets the fade. */}
          {Platform.OS === 'ios' ? (
            <RevealBlur progress={contentProgress} />
          ) : null}
        </View>
      </BottomSheetView>
    </BottomSheetModal>
  );
}

/**
 * Starts below its slot and rides up behind the sheet, spinning one turn on
 * its vertical axis as it lands - the full turn keeps the glyph from ever
 * resting mirrored.
 */
function SignOutIcon({ progress }: { progress: SharedValue<number> }) {
  const style = useAnimatedStyle(() => {
    const p = progress.get();
    return {
      opacity: interpolate(p, [0, 0.12], [0, 1], Extrapolation.CLAMP),
      transform: [
        { perspective: 800 },
        { translateY: interpolate(p, [0, 1], [ICON_RISE, 0]) },
        {
          rotateY: `${interpolate(p, [0.3, 1], [-360, 0], {
            extrapolateLeft: Extrapolation.CLAMP,
            extrapolateRight: Extrapolation.EXTEND,
          })}deg`,
        },
        { scale: interpolate(p, [0, 1], [0.8, 1]) },
      ],
    };
  });

  return (
    <Animated.View
      style={[
        {
          width: ICON_SIZE,
          height: ICON_SIZE,
          borderRadius: ICON_SIZE / 2,
          alignItems: 'center',
          justifyContent: 'center',
          experimental_backgroundImage:
            'linear-gradient(to bottom, #f87171, #dc2626)',
          boxShadow: '0 8px 20px rgba(220, 38, 38, 0.3)',
        },
        style,
      ]}
    >
      <Icon as={LogOutIcon} size={26} strokeWidth={2.25} color="#ffffff" />
    </Animated.View>
  );
}

function Reveal({
  progress,
  index,
  children,
}: {
  progress: SharedValue<number>;
  index: number;
  children: React.ReactNode;
}) {
  const style = useAnimatedStyle(() => {
    const start = index * CONTENT_STAGGER;
    const p = interpolate(
      progress.get(),
      [start, start + 0.6],
      [0, 1],
      Extrapolation.CLAMP,
    );
    return {
      opacity: p,
      transform: [{ translateY: (1 - p) * CONTENT_DRIFT }],
    };
  });

  return (
    <Animated.View style={[{ width: '100%', alignItems: 'center' }, style]}>
      {children}
    </Animated.View>
  );
}

function RevealBlur({ progress }: { progress: SharedValue<number> }) {
  const animatedProps = useAnimatedProps(() => ({
    intensity: interpolate(
      progress.get(),
      [0, 0.85],
      [BLUR_INTENSITY, 0],
      Extrapolation.CLAMP,
    ),
  }));

  return (
    <AnimatedBlurView
      animatedProps={animatedProps}
      style={[StyleSheet.absoluteFill, { pointerEvents: 'none' }]}
    />
  );
}
