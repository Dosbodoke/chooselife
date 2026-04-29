import {
  Canvas,
  Circle,
  Group,
  LinearGradient,
  Path,
  RadialGradient,
  Rect,
  RoundedRect,
  Skia,
  vec,
} from '@shopify/react-native-skia';
import {
  CalendarDaysIcon,
  MapPinIcon,
  ShieldCheckIcon,
} from 'lucide-react-native';
import * as React from 'react';
import {
  Pressable,
  StyleProp,
  useWindowDimensions,
  View,
  ViewStyle,
} from 'react-native';
import Animated, {
  FadeInDown,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import ChooselifeIcon from '~/lib/icons/chooselife-icon';

import { Icon } from '~/components/ui/icon';
import { Text } from '~/components/ui/text';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type LicenseCardVariant = 'indigo' | 'purple' | 'slate' | 'emerald';

type LicenseCardPalette = {
  background: [string, string, string];
  glow: string;
  line: string;
  chip: string;
  text: string;
};

const PALETTES: Record<LicenseCardVariant, LicenseCardPalette> = {
  indigo: {
    background: ['#7257ff', '#3f38d0', '#141943'],
    glow: '#b8a8ff',
    line: '#c7bfff',
    chip: 'rgba(255, 255, 255, 0.16)',
    text: '#ffffff',
  },
  purple: {
    background: ['#df35ff', '#8b18c9', '#2d0c4d'],
    glow: '#ffd0ff',
    line: '#f7b8ff',
    chip: 'rgba(255, 255, 255, 0.18)',
    text: '#ffffff',
  },
  slate: {
    background: ['#71808d', '#344250', '#141b24'],
    glow: '#d7e8f8',
    line: '#d8e5ef',
    chip: 'rgba(255, 255, 255, 0.13)',
    text: '#ffffff',
  },
  emerald: {
    background: ['#27e3a0', '#098a71', '#12302d'],
    glow: '#c3ffe7',
    line: '#bcffe4',
    chip: 'rgba(255, 255, 255, 0.16)',
    text: '#ffffff',
  },
};

export type LicenseCardProps = {
  holderName?: string;
  eventName?: string;
  ticketName?: string;
  location?: string;
  validFrom?: string;
  validUntil?: string;
  serialNumber?: string;
  statusLabel?: string;
  variant?: LicenseCardVariant;
  style?: StyleProp<ViewStyle>;
};

export function LicenseCard({
  holderName = 'Chooselife Member',
  eventName = 'Chooselife Festival',
  ticketName = 'Member Pass',
  location = 'Brazil',
  validFrom = 'Mar 21, 2026',
  validUntil = 'Mar 27, 2026',
  serialNumber = '#0012',
  statusLabel = 'Active ticket',
  variant = 'indigo',
  style,
}: LicenseCardProps) {
  const { width } = useWindowDimensions();
  const cardWidth = Math.min(width - 48, 340);
  const cardHeight = Math.round(cardWidth * 1.42);
  const palette = PALETTES[variant];
  const pressProgress = useSharedValue(0);

  const cardStyle = useAnimatedStyle<ViewStyle>(() => {
    const pressed = interpolate(pressProgress.value, [0, 1], [1, 0.975]);

    return {
      transform: [{ scale: pressed }],
    };
  });

  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityLabel={`${ticketName} for ${holderName}`}
      entering={FadeInDown.duration(420)}
      onPressIn={() => {
        pressProgress.value = withTiming(1, { duration: 140 });
      }}
      onPressOut={() => {
        pressProgress.value = withTiming(0, { duration: 180 });
      }}
      style={[
        {
          width: cardWidth,
          height: cardHeight,
          borderRadius: 28,
          boxShadow: '0 22px 44px rgba(0, 0, 0, 0.28)',
        },
        cardStyle,
        style,
      ]}
    >
      <View className="flex-1 overflow-hidden rounded-[28px] border border-white/20">
        <LicenseCardCanvas
          width={cardWidth}
          height={cardHeight}
          palette={palette}
        />

        <View className="absolute inset-0 justify-between p-6">
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center gap-2">
              <View
                className="size-8 items-center justify-center rounded-full border border-white/20"
                style={{ backgroundColor: palette.chip }}
              >
                <ChooselifeIcon width={17} height={17} fill={palette.text} />
              </View>
              <Text className="text-xs font-bold uppercase tracking-wider text-white/80">
                Chooselife
              </Text>
            </View>

            <View
              className="flex-row items-center gap-1.5 rounded-full border border-white/15 px-3 py-1.5"
              style={{ backgroundColor: palette.chip }}
            >
              <Icon as={ShieldCheckIcon} size={13} className="text-white" />
              <Text className="text-[10px] font-bold uppercase tracking-wider text-white">
                {statusLabel}
              </Text>
            </View>
          </View>

          <View className="items-center gap-3">
            <View
              className="h-16 w-16 items-center justify-center rounded-2xl border border-white/25"
              style={{ backgroundColor: palette.chip }}
            >
              <ChooselifeIcon width={34} height={34} fill={palette.text} />
            </View>

            <View className="items-center gap-1">
              <Text
                numberOfLines={1}
                adjustsFontSizeToFit
                className="text-center text-3xl font-black text-white"
              >
                {ticketName}
              </Text>
              <Text
                numberOfLines={1}
                className="text-center text-sm font-semibold text-white/72"
              >
                {holderName}
              </Text>
            </View>

            <View className="h-px w-28 bg-white/25" />

            <Text
              numberOfLines={1}
              className="text-center text-xs font-semibold uppercase tracking-wider text-white/62"
            >
              {eventName}
            </Text>
          </View>

          <View className="gap-4">
            <View className="flex-row items-center gap-2">
              <Icon as={MapPinIcon} size={15} className="text-white/80" />
              <Text
                numberOfLines={1}
                className="text-sm font-semibold text-white/80"
              >
                {location}
              </Text>
            </View>

            <View className="flex-row items-end justify-between">
              <View className="gap-1">
                <View className="flex-row items-center gap-2">
                  <Icon
                    as={CalendarDaysIcon}
                    size={14}
                    className="text-white/70"
                  />
                  <Text className="text-[10px] font-bold uppercase tracking-wider text-white/54">
                    Valid from
                  </Text>
                </View>
                <Text className="text-sm font-black text-white">
                  {validFrom}
                </Text>
              </View>

              <View className="items-end gap-1">
                <Text className="text-[10px] font-bold uppercase tracking-wider text-white/54">
                  Until
                </Text>
                <Text className="text-sm font-black text-white">
                  {validUntil}
                </Text>
              </View>

              <View className="items-end gap-1">
                <Text className="text-[10px] font-bold uppercase tracking-wider text-white/54">
                  Serial
                </Text>
                <Text selectable className="text-sm font-black text-white">
                  {serialNumber}
                </Text>
              </View>
            </View>
          </View>
        </View>
      </View>
    </AnimatedPressable>
  );
}

function LicenseCardCanvas({
  width,
  height,
  palette,
}: {
  width: number;
  height: number;
  palette: LicenseCardPalette;
}) {
  const wavePaths = React.useMemo(() => {
    return Array.from({ length: 20 }, (_, index) => {
      const path = Skia.Path.Make();
      const y = 62 + index * 12;

      path.moveTo(-24, y);
      for (let x = -24; x <= width + 24; x += 22) {
        path.quadTo(x + 11, y + (index % 2 === 0 ? 6 : -6), x + 22, y);
      }

      return path;
    });
  }, [width]);

  const grainPath = React.useMemo(() => {
    const path = Skia.Path.Make();

    for (let index = 0; index < 90; index += 1) {
      const x = (index * 47) % width;
      const y = (index * 31) % height;
      path.addCircle(x, y, index % 3 === 0 ? 0.8 : 0.45);
    }

    return path;
  }, [height, width]);

  return (
    <Canvas style={{ width, height }}>
      <RoundedRect x={0} y={0} width={width} height={height} r={28}>
        <LinearGradient
          start={vec(0, 0)}
          end={vec(width, height)}
          colors={palette.background}
        />
      </RoundedRect>

      <Circle
        cx={width * 0.16}
        cy={height * 0.1}
        r={width * 0.74}
        opacity={0.62}
      >
        <RadialGradient
          c={vec(width * 0.16, height * 0.1)}
          r={width * 0.74}
          colors={[palette.glow, 'transparent']}
        />
      </Circle>

      <Circle
        cx={width * 0.92}
        cy={height * 0.72}
        r={width * 0.5}
        opacity={0.28}
      >
        <RadialGradient
          c={vec(width * 0.92, height * 0.72)}
          r={width * 0.5}
          colors={[palette.glow, 'transparent']}
        />
      </Circle>

      <Group opacity={0.13}>
        {wavePaths.map((path, index) => (
          <Path
            key={`wave-${index}`}
            path={path}
            color={palette.line}
            style="stroke"
            strokeWidth={1}
          />
        ))}
      </Group>

      <Path path={grainPath} color="white" opacity={0.16} />

      <Rect x={0} y={0} width={width} height={height} opacity={0.2}>
        <LinearGradient
          start={vec(width * 0.1, 0)}
          end={vec(width * 0.9, height)}
          colors={['rgba(255,255,255,0.34)', 'transparent', 'rgba(0,0,0,0.35)']}
        />
      </Rect>
    </Canvas>
  );
}
