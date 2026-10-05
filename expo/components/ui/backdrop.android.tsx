import type { ProgressiveBlurViewProps } from 'expo-backdrop';
import React, { useId } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

export { BlurView } from 'expo-backdrop';

// Native progressive blur washes out the screen and can receive a null
// PixelCopy bitmap during Android navigation. Use a tint gradient instead.
export const ProgressiveBlurView: React.FC<ProgressiveBlurViewProps> = ({
  style,
  children,
  edge = 'top',
  startOffset = 0,
  intensity = 25,
  fallbackColor = 'rgb(243,244,246)',
}) => {
  const gradientId = useId();
  const horizontal = edge === 'left' || edge === 'right';
  const reversed = edge === 'bottom' || edge === 'right';
  const start = reversed ? '100%' : '0%';
  const end = reversed ? '0%' : '100%';
  const opacity = Math.min(100, Math.max(0, intensity)) / 100;

  return (
    <View style={style}>
      <Svg
        width="100%"
        height="100%"
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      >
        <Defs>
          <LinearGradient
            id={gradientId}
            x1={horizontal ? start : '0%'}
            y1={horizontal ? '0%' : start}
            x2={horizontal ? end : '0%'}
            y2={horizontal ? '0%' : end}
          >
            <Stop offset="0%" stopColor={fallbackColor} stopOpacity={opacity} />
            <Stop
              offset={`${Math.min(1, Math.max(0, startOffset)) * 100}%`}
              stopColor={fallbackColor}
              stopOpacity={opacity}
            />
            <Stop offset="100%" stopColor={fallbackColor} stopOpacity={0} />
          </LinearGradient>
        </Defs>
        <Rect width="100%" height="100%" fill={`url(#${gradientId})`} />
      </Svg>
      {children}
    </View>
  );
};
