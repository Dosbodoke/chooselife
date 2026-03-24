import React, { useEffect, useMemo } from 'react';
import {
  Canvas,
  Circle,
  Group,
  Path,
  Skia,
} from '@shopify/react-native-skia';
import {
  Easing,
  useDerivedValue,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
  runOnJS,
  interpolate,
  Extrapolation,
  withSequence,
} from 'react-native-reanimated';

interface SuccessAnimationProps {
  size?: number;
  dotColor?: string;
  iconColor?: string;
  backgroundColor?: string;
  onAnimationEnd?: () => void;
}

/**
 * SuccessAnimation component - A highly polished Skia animation
 * Inspired by William Candillon's "Can it be done in React Native" series.
 */
export default function SuccessAnimation({
  size = 100, // Balanced size to fit standard containers without clipping
  dotColor = '#44c6b1',
  iconColor = '#FFF',
  backgroundColor = '#44c6b1',
  onAnimationEnd,
}: SuccessAnimationProps) {
  const circleScale = useSharedValue(0);
  const checkProgress = useSharedValue(0);
  const particleProgress = useSharedValue(0);

  useEffect(() => {
    // 1. Main circle pops in with a snappy spring
    circleScale.value = withSpring(1, {
      damping: 12,
      stiffness: 120,
      mass: 0.8,
    });

    // 2. Particles burst out slightly after the circle starts appearing
    particleProgress.value = withDelay(
      150,
      withTiming(1, {
        duration: 800,
        easing: Easing.bezier(0.22, 1, 0.36, 1),
      })
    );

    // 3. Checkmark draws with a bit of overshoot for personality
    checkProgress.value = withDelay(
      350,
      withTiming(1, {
        duration: 450,
        easing: Easing.bezier(0.34, 1.56, 0.64, 1),
      }, (finished) => {
        if (finished) {
          // A subtle "impact" pop to feel the achievement
          circleScale.value = withSequence(
            withTiming(1.08, { duration: 100 }),
            withSpring(1)
          );
          if (onAnimationEnd) {
            runOnJS(onAnimationEnd)();
          }
        }
      })
    );
  }, [onAnimationEnd]);

  const center = size / 2;
  const canvasSize = size * 1.6; // Extra padding for particles burst
  const offset = (canvasSize - size) / 2;

  // Memoized path for performance
  const checkmarkPath = useMemo(() => {
    const p = Skia.Path.Make();
    // Centered checkmark within the size
    p.moveTo(size * 0.32, size * 0.52);
    p.lineTo(size * 0.45, size * 0.65);
    p.lineTo(size * 0.72, size * 0.38);
    return p;
  }, [size]);

  // Pre-calculate particle directions
  const particles = useMemo(() => 
    Array.from({ length: 12 }).map((_, i) => {
      const angle = (i * Math.PI * 2) / 12;
      const velocity = i % 2 === 0 ? 1 : 0.7;
      return { angle, velocity };
    })
  , []);

  return (
    <Canvas style={{ width: canvasSize, height: canvasSize }}>
      <Group transform={[{ translateX: offset }, { translateY: offset }]}>
        {/* Main Success Circle */}
        {/* Hide group until scale is > 0 to avoid "pixel popping" artifacts */}
        <Group opacity={useDerivedValue(() => circleScale.value > 0 ? 1 : 0)}>
          <Circle
            cx={center}
            cy={center}
            r={useDerivedValue(() => (size / 2) * 0.9 * circleScale.value)}
            color={backgroundColor}
          />
        </Group>

        {/* Dynamic Particles Burst */}
        {particles.map((p, i) => {
          const particleCx = useDerivedValue(() => {
            // Keep particles off-canvas until they start moving
            if (particleProgress.value <= 0.01) return -1000;
            const dist = size * 0.65 * p.velocity * particleProgress.value;
            return center + Math.cos(p.angle) * dist;
          });
          const particleCy = useDerivedValue(() => {
            if (particleProgress.value <= 0.01) return -1000;
            const dist = size * 0.65 * p.velocity * particleProgress.value;
            return center + Math.sin(p.angle) * dist;
          });
          const particleR = useDerivedValue(() => {
            if (particleProgress.value <= 0.01) return 0;
            const baseRadius = size * 0.035;
            // Radius grows quickly then fades to zero as it travels
            return particleProgress.value < 0.2
              ? interpolate(particleProgress.value, [0, 0.2], [0, baseRadius], Extrapolation.CLAMP)
              : interpolate(particleProgress.value, [0.2, 1], [baseRadius, 0], Extrapolation.CLAMP);
          });

          return (
            <Circle
              key={i}
              cx={particleCx}
              cy={particleCy}
              r={particleR}
              color={dotColor}
              opacity={useDerivedValue(() => 1 - particleProgress.value)}
            />
          );
        })}

        {/* Polished Checkmark drawing effect */}
        <Path
          path={checkmarkPath}
          color={iconColor}
          style="stroke"
          strokeWidth={size * 0.1}
          strokeCap="round"
          strokeJoin="round"
          start={0}
          end={checkProgress}
        />
      </Group>
    </Canvas>
  );
}
