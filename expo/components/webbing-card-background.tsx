import {
  Canvas,
  Group,
  Rect,
  Mask,
  RadialGradient,
  vec,
} from '@shopify/react-native-skia';
import { useColorScheme } from 'nativewind';
import React from 'react';
import { View, Dimensions } from 'react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const WebbingCardBackground: React.FC = () => {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const color = isDark ? '#ffffff' : '#000000';
  
  // Blueprint Grid Generation
  const gridSize = 20;
  const gridLines = React.useMemo(() => {
    const lines = [];
    // Increase range slightly to ensure coverage, using SCREEN_WIDTH
    const maxX = SCREEN_WIDTH + 50;
    const maxY = 400; // Arbitrary height, sufficient for card

    for (let i = 0; i < maxX; i += gridSize) {
      // Vertical
      lines.push(<Rect key={`v-${i}`} x={i} y={0} width={1} height={maxY} color={color} opacity={0.20} />);
    }
    for (let i = 0; i < maxY; i += gridSize) {
       // Horizontal
       lines.push(<Rect key={`h-${i}`} x={0} y={i} width={maxX} height={1} color={color} opacity={0.20} />);
    }
    return lines;
  }, [color]);

  return (
    <View className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
      <Canvas style={{ flex: 1 }}>
        <Mask
          mask={
            <Rect x={0} y={0} width={SCREEN_WIDTH} height={400}>
              <RadialGradient
                c={vec(SCREEN_WIDTH - 20, 0)} // Top-Right Corner
                r={SCREEN_WIDTH * 1.5}
                colors={['white', 'transparent']}
              />
            </Rect>
          }
        >
          {/* 1. Blueprint Grid Background */}
          <Group>
            {gridLines}
          </Group>
        </Mask>
      </Canvas>
    </View>
  );
};

export { WebbingCardBackground };
