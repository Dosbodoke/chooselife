import { View } from 'react-native';
import Svg, { Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

export type PodiumVariant = 'gold' | 'silver' | 'bronze';

export const podiumSteps = {
  gold: {
    artboard: 'Gold',
    height: 112,
    delay: 167,
    top: '#FFE39B',
    bottom: '#E5AD2E',
    edge: '#FFF0BF',
  },
  silver: {
    artboard: 'Silver',
    height: 80,
    delay: 83,
    top: '#E5E7EB',
    bottom: '#9CA3AF',
    edge: '#F9FAFB',
  },
  bronze: {
    artboard: 'Bronze',
    height: 64,
    delay: 0,
    top: '#F0C4A1',
    bottom: '#B87543',
    edge: '#FFDFC4',
  },
} as const;

export interface PodiumStepProps {
  variant: PodiumVariant;
  reduceMotion: boolean;
}

export function StaticPodiumStep({
  variant,
}: Pick<PodiumStepProps, 'variant'>) {
  const step = podiumSteps[variant];

  return (
    <View
      testID={`ranking-podium-static-${variant}`}
      pointerEvents="none"
      style={{ width: '100%', height: step.height }}
    >
      <Svg
        width="100%"
        height="100%"
        viewBox={`0 0 120 ${step.height}`}
        preserveAspectRatio="none"
      >
        <Defs>
          <LinearGradient id={`podium-${variant}`} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={step.top} />
            <Stop offset="1" stopColor={step.bottom} />
          </LinearGradient>
        </Defs>
        <Path
          d={`M2 8 Q2 0 10 0 H110 Q118 0 118 8 V${step.height} H2 Z`}
          fill={`url(#podium-${variant})`}
        />
        <Rect x="2" width="116" height="6" rx="3" fill={step.edge} />
      </Svg>
    </View>
  );
}
