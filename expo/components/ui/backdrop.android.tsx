import type { BlurViewProps, ProgressiveBlurViewProps } from 'expo-backdrop';
import React, { useId } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

// Android backdrop capture can wash out the entire React Native canvas.
// Keep the material confined to this view without capturing the window.
export const BlurView: React.FC<BlurViewProps> = ({
  style,
  children,
  tint,
  tintColor,
  cornerRadius,
  cornerRadii,
}) => {
  const light =
    tint?.toString().includes('Light') ||
    tint === 'light' ||
    tint === 'extraLight';

  return (
    <View
      style={[
        {
          overflow: 'hidden',
          backgroundColor:
            tintColor ??
            (light ? 'rgba(243,244,246,0.9)' : 'rgba(24,24,27,0.65)'),
          borderRadius: cornerRadius,
          borderTopLeftRadius: cornerRadii?.topLeft ?? cornerRadius,
          borderTopRightRadius: cornerRadii?.topRight ?? cornerRadius,
          borderBottomRightRadius: cornerRadii?.bottomRight ?? cornerRadius,
          borderBottomLeftRadius: cornerRadii?.bottomLeft ?? cornerRadius,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
};

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
  // Nothing is blurred behind the tint, so it has to hide the content on its
  // own: run it stronger than `intensity` alone (70 -> ~0.9).
  const opacity = Math.min(1, (Math.max(0, intensity) / 100) * 1.3);

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
