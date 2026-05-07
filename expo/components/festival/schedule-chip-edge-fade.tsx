import {
  Canvas,
  LinearGradient,
  Rect,
  vec,
} from '@shopify/react-native-skia';
import React from 'react';
import { View } from 'react-native';

export const ScheduleChipEdgeFade: React.FC<{
  direction: 'left' | 'right';
}> = ({ direction }) => {
  const colors =
    direction === 'left'
      ? ['#ffffff', 'rgba(255,255,255,0)']
      : ['rgba(255,255,255,0)', '#ffffff'];

  return (
    <View
      pointerEvents="none"
      className={`absolute bottom-0 top-0 w-6 ${
        direction === 'left' ? 'left-0' : 'right-0'
      }`}
    >
      <Canvas style={{ flex: 1 }}>
        <Rect x={0} y={0} width={24} height={9999}>
          <LinearGradient start={vec(0, 0)} end={vec(24, 0)} colors={colors} />
        </Rect>
      </Canvas>
    </View>
  );
};
