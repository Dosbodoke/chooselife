import type { BlurViewProps, ProgressiveBlurViewProps } from 'expo-backdrop';
import React from 'react';
import { View } from 'react-native';

/** Translucent stand-in: `expo-backdrop` has no web implementation. */
export const BlurView: React.FC<BlurViewProps> = ({
  style,
  children,
  cornerRadius,
  tint,
  tintColor,
}) => (
  <View
    style={[
      {
        overflow: 'hidden',
        borderRadius: cornerRadius,
        backgroundColor:
          tintColor ??
          (tint?.toString().includes('Light') || tint === 'light'
            ? 'rgba(255,255,255,0.8)'
            : 'rgba(0,0,0,0.5)'),
      },
      style,
    ]}
  >
    {children}
  </View>
);

export const ProgressiveBlurView: React.FC<ProgressiveBlurViewProps> = ({
  style,
  children,
}) => (
  <View style={[{ backgroundColor: 'rgba(243,244,246,0.9)' }, style]}>
    {children}
  </View>
);
