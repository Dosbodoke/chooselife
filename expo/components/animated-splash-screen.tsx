import SplashLogo from '~/assets/icons/splash-icon-dark.png';
import { Image } from 'expo-image';
import * as SplashScreen from 'expo-splash-screen';
import React from 'react';
import { StyleSheet, useWindowDimensions } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useDerivedValue,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Canvas, Path, Skia, type SkSize } from 'react-native-skia';
import { scheduleOnRN } from 'react-native-worklets';

const BACKGROUND_COLOR = '#FFFFFF';
const LINE_COLOR = '#000000';

// Must match `imageWidth` of the expo-splash-screen plugin in app.config.ts,
// so the first frame of this overlay is pixel-identical to the native splash.
const SPLASH_IMAGE_SIZE = 200;

// Glyph bounds measured from the 1024px PNG, scaled to SPLASH_IMAGE_SIZE.
const LOGO_WIDTH = 84;
const LOGO_BASELINE_OFFSET = 50;

const LINE_STROKE_WIDTH = 2.5;
const LINE_OFFSET = LOGO_BASELINE_OFFSET + 7 + LINE_STROKE_WIDTH / 2; // below screen center

const MAX_SAG = 14;

// The backup hangs below the main line in loops, joined to it every
// BACKUP_SPACING and at the anchors off each edge.
const BACKUP_STROKE_WIDTH = 1.75;
const BACKUP_SPACING = 70;
const BACKUP_EDGE_MARGIN = 12;
const BACKUP_DEPTH_RATIO = 0.16;
const MAX_BACKUP_DEPTH = 12;
const MAX_BACKUP_SWING = 9;

const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);

const LINE_DRAW_DELAY = 60;
const LINE_DRAW_DURATION = 460;
const BACKUP_DRAW_DELAY = 200;
const BACKUP_DRAW_DURATION = 560;
const STEP_ON_DELAY = 440;
const STEP_ON_DURATION = 200;
const REBOUND = { duration: 760, dampingRatio: 0.32 };
const BACKUP_SWING_DELAY = 520;
const BACKUP_SWING_DURATION = 240;
const BACKUP_REBOUND = { duration: 1000, dampingRatio: 0.28 };
const EXIT_DELAY = 1380;
const EXIT_DURATION = 620;
const REDUCED_MOTION_EXIT_DURATION = 250;

/** Y of the main line at `x` while the logo presses it down by `sag`. */
function mainLineY(x: number, width: number, restY: number, sag: number) {
  'worklet';
  const distance = Math.abs(x - width / 2);
  if (distance <= LOGO_WIDTH / 2) return restY + sag;
  const span = width / 2 - LOGO_WIDTH / 2;
  return restY + sag * (1 - (distance - LOGO_WIDTH / 2) / span);
}

/** Where the backup meets the main line, from the left anchor to the right. */
function backupJoints(width: number) {
  'worklet';
  const offsets: number[] = [];
  for (
    let offset = BACKUP_SPACING / 2;
    offset < width / 2 - BACKUP_EDGE_MARGIN;
    offset += BACKUP_SPACING
  ) {
    offsets.push(offset);
  }
  return [
    0,
    ...offsets.map((offset) => width / 2 - offset).reverse(),
    ...offsets.map((offset) => width / 2 + offset),
    width,
  ];
}

/**
 * Takes over from the native splash with the same logo in the same spot, then
 * rigs a highline under it: the main line draws out from under the logo with
 * its backup hanging below in loops, the line sags as the logo steps on and
 * bounces while the loose backup swings after it, and finally the screen
 * splits open along the line to reveal the app.
 */
export function AnimatedSplashScreen() {
  const [isFinished, setIsFinished] = React.useState(false);
  const reduceMotion = useReducedMotion();
  const { height: windowHeight } = useWindowDimensions();

  const canvasSize = useSharedValue<SkSize>({ width: 0, height: 0 });
  const lineProgress = useSharedValue(0);
  const backupProgress = useSharedValue(0);
  const sag = useSharedValue(0);
  const backupSwing = useSharedValue(0);
  const exitProgress = useSharedValue(0);
  const opacity = useSharedValue(1);
  const hasStarted = React.useRef(false);

  const finish = () => setIsFinished(true);

  const play = async () => {
    if (hasStarted.current) return;
    hasStarted.current = true;

    await SplashScreen.hideAsync().catch(() => undefined);

    if (reduceMotion) {
      opacity.set(
        withTiming(
          0,
          { duration: REDUCED_MOTION_EXIT_DURATION, easing: EASE_OUT },
          (finished) => {
            if (finished) scheduleOnRN(finish);
          },
        ),
      );
      return;
    }

    lineProgress.set(
      withDelay(
        LINE_DRAW_DELAY,
        withTiming(1, { duration: LINE_DRAW_DURATION, easing: EASE_OUT }),
      ),
    );
    backupProgress.set(
      withDelay(
        BACKUP_DRAW_DELAY,
        withTiming(1, { duration: BACKUP_DRAW_DURATION, easing: EASE_OUT }),
      ),
    );
    sag.set(
      withDelay(
        STEP_ON_DELAY,
        withSequence(
          withTiming(MAX_SAG, {
            duration: STEP_ON_DURATION,
            easing: Easing.out(Easing.quad),
          }),
          withSpring(0, REBOUND),
        ),
      ),
    );
    backupSwing.set(
      withDelay(
        BACKUP_SWING_DELAY,
        withSequence(
          withTiming(MAX_BACKUP_SWING, {
            duration: BACKUP_SWING_DURATION,
            easing: Easing.out(Easing.quad),
          }),
          withSpring(0, BACKUP_REBOUND),
        ),
      ),
    );
    exitProgress.set(
      withDelay(
        EXIT_DELAY,
        withTiming(
          1,
          { duration: EXIT_DURATION, easing: EASE_OUT },
          (finished) => {
            if (finished) scheduleOnRN(finish);
          },
        ),
      ),
    );
  };

  const handleImageError = () => {
    void SplashScreen.hideAsync().catch(() => undefined);
    finish();
  };

  // A rigid load on a tensioned line: flat under the logo, straight to the anchors.
  const linePath = useDerivedValue(() => {
    const { width, height } = canvasSize.get();
    const y = height / 2 + LINE_OFFSET;
    const loadY = y + sag.get();
    const path = Skia.PathBuilder.Make();

    path.moveTo(0, y);
    path.lineTo(width / 2 - LOGO_WIDTH / 2, loadY);
    path.lineTo(width / 2 + LOGO_WIDTH / 2, loadY);
    path.lineTo(width, y);

    return path.build();
  });
  const lineStart = useDerivedValue(() => 0.5 - lineProgress.get() / 2);
  const lineEnd = useDerivedValue(() => 0.5 + lineProgress.get() / 2);
  const lineOpacity = useDerivedValue(() => (lineProgress.get() > 0 ? 1 : 0));

  // Each loop droops from one joint on the main line to the next, deeper when
  // the span is wider, and deeper still while the backup swings.
  const backupPath = useDerivedValue(() => {
    const { width, height } = canvasSize.get();
    const restY = height / 2 + LINE_OFFSET;
    const currentSag = sag.get();
    const joints = backupJoints(width);
    const path = Skia.PathBuilder.Make();

    path.moveTo(0, restY);
    for (let i = 1; i < joints.length; i++) {
      const fromX = joints[i - 1];
      const toX = joints[i];
      const fromY = mainLineY(fromX, width, restY, currentSag);
      const toY = mainLineY(toX, width, restY, currentSag);
      const span = toX - fromX;
      const depth =
        Math.min(span * BACKUP_DEPTH_RATIO, MAX_BACKUP_DEPTH) +
        backupSwing.get() * Math.min(span / BACKUP_SPACING, 1);
      path.quadTo((fromX + toX) / 2, (fromY + toY) / 2 + depth * 2, toX, toY);
    }

    return path.build();
  });
  const backupStart = useDerivedValue(() => 0.5 - backupProgress.get() / 2);
  const backupEnd = useDerivedValue(() => 0.5 + backupProgress.get() / 2);
  const backupOpacity = useDerivedValue(() =>
    backupProgress.get() > 0 ? 1 : 0,
  );

  const rootStyle = useAnimatedStyle(() => ({ opacity: opacity.get() }));
  const upperStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -exitProgress.get() * windowHeight }],
  }));
  const lowerStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: exitProgress.get() * windowHeight }],
  }));
  const logoStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: sag.get() - exitProgress.get() * windowHeight }],
  }));

  if (isFinished) {
    return null;
  }

  return (
    <Animated.View
      style={[StyleSheet.absoluteFill, rootStyle]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Animated.View style={[styles.upperPanel, upperStyle]} />
      <Animated.View style={[styles.lowerPanel, lowerStyle]} />
      <Animated.View style={[styles.logoLayer, logoStyle]}>
        <Image
          source={SplashLogo}
          style={styles.logo}
          contentFit="contain"
          onDisplay={play}
          onError={handleImageError}
        />
      </Animated.View>
      <Animated.View
        style={[StyleSheet.absoluteFill, upperStyle]}
        pointerEvents="none"
      >
        <Canvas style={StyleSheet.absoluteFill} onSize={canvasSize}>
          <Path
            path={backupPath}
            start={backupStart}
            end={backupEnd}
            opacity={backupOpacity}
            color={LINE_COLOR}
            style="stroke"
            strokeWidth={BACKUP_STROKE_WIDTH}
            strokeCap="round"
          />
          <Path
            path={linePath}
            start={lineStart}
            end={lineEnd}
            opacity={lineOpacity}
            color={LINE_COLOR}
            style="stroke"
            strokeWidth={LINE_STROKE_WIDTH}
            strokeJoin="round"
          />
        </Canvas>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  // The panels meet at the line and overlap by a pixel so no seam shows.
  upperPanel: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: '50%',
    marginBottom: -LINE_OFFSET - 1,
    backgroundColor: BACKGROUND_COLOR,
  },
  lowerPanel: {
    position: 'absolute',
    top: '50%',
    left: 0,
    right: 0,
    bottom: 0,
    marginTop: LINE_OFFSET,
    backgroundColor: BACKGROUND_COLOR,
  },
  logoLayer: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    width: SPLASH_IMAGE_SIZE,
    height: SPLASH_IMAGE_SIZE,
  },
});
