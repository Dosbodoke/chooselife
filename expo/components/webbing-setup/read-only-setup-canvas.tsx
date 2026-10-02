// Read-only version of the rig form's setup drawing: same renderer, grid,
// height and 1 m = 1 px horizontal scroll, without focus or validation.

import React, { useMemo, useState } from 'react';
import { View } from 'react-native';
import {
  useAnimatedScrollHandler,
  useSharedValue,
} from 'react-native-reanimated';

import {
  CANVA_PADDING,
  CanvasGrid,
  computeWebbingSectionData,
  ScrollableCanvas,
} from './setup-canvas';
import { WebSection } from './webbing-sections';

export type ReadOnlySection = {
  length: number;
  leftLoop: boolean;
  rightLoop: boolean;
};

export const ReadOnlySetupCanvas: React.FC<{
  main: ReadOnlySection[];
  backup: ReadOnlySection[];
}> = ({ main, backup }) => {
  const [size, setSize] = useState({ width: 0, height: 0 });
  const scrollX = useSharedValue(0);
  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollX.value = event.contentOffset.x;
    },
  });

  const paths = useMemo(() => {
    const toFormShape = (section: ReadOnlySection) => ({
      ...section,
      length: String(section.length),
    });
    return {
      main: computeWebbingSectionData(main.map(toFormShape), 'main'),
      backup: computeWebbingSectionData(backup.map(toFormShape), 'backup'),
    };
  }, [main, backup]);

  const canvasWidth = Math.max(
    size.width,
    Math.max(paths.main.totalLength, paths.backup.totalLength) +
      CANVA_PADDING * 2,
  );

  return (
    <View
      className="relative h-64 w-full overflow-hidden rounded-2xl border border-border"
      onLayout={(event) => {
        const { width, height } = event.nativeEvent.layout;
        setSize({ width, height });
      }}
    >
      <CanvasGrid width={size.width} height={size.height} />
      <ScrollableCanvas
        width={canvasWidth}
        height={size.height}
        containerWidth={size.width}
        containerHeight={size.height}
        scrollHandler={scrollHandler}
        onTapEnd={() => {}}
      >
        <WebSection
          type="main"
          paths={paths.main.webbings}
          focusedType={null}
          focusedIndex={null}
        />
        <WebSection
          type="backup"
          paths={paths.backup.webbings}
          focusedType={null}
          focusedIndex={null}
        />
      </ScrollableCanvas>
    </View>
  );
};
