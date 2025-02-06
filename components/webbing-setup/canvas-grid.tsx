import { Canvas, Path, Skia } from '@shopify/react-native-skia';
import { useMemo } from 'react';

// Dot grid pattern on a Skia canva
export const CanvasGrid: React.FC<{ width: number; height: number }> = ({
  width,
  height,
}) => {
  const DOT_RADIUS = 1.5;
  const DOT_SPACING = 20;
  const DOT_COLOR = '#CCCCCC';

  const path = useMemo(() => {
    const p = Skia.Path.Make();

    // Create a single path containing all dots
    for (let x = 0; x <= width; x += DOT_SPACING) {
      for (let y = 0; y <= height; y += DOT_SPACING) {
        p.addCircle(x, y, DOT_RADIUS);
      }
    }

    return p;
  }, [width, height]);

  return (
    <Canvas
      style={{
        width,
        height,
        position: 'absolute',
      }}
    >
      <Path path={path} color={DOT_COLOR} style="fill" />
    </Canvas>
  );
};
