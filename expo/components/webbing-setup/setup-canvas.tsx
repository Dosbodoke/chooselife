// Create a visual representation of a highline setup on a Skia Canvas

import { Canvas, Path, Skia, SkPath } from '@shopify/react-native-skia';
import React, { useEffect, useMemo, useState } from 'react';
import { UseFormReturn } from 'react-hook-form';
import { View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import type {
  FocusedWebbing,
  RigSchema,
  WebbingWithId,
  WebType,
} from '~/context/rig-form';

import { validateConnections, validateSectionLoops } from './validate';
import { WebPathGestureHandler, WebSection } from './webbing-sections';

const CANVA_PADDING = 50;

export type WebbingValidationErrors = {
  main?: string;
  backup?: string;
  connection?: string;
};

export const SetupCanva: React.FC<{
  form: UseFormReturn<RigSchema>;
  mainSections: WebbingWithId[];
  backupSections: WebbingWithId[];
  focusedWebbing: FocusedWebbing;
  highlineLength: number;
  setFocusedWebbing: React.Dispatch<React.SetStateAction<FocusedWebbing>>;
  onValidationError?: (errors: WebbingValidationErrors) => void;
}> = ({
  form,
  mainSections,
  backupSections,
  focusedWebbing,
  highlineLength,
  setFocusedWebbing,
  onValidationError,
}) => {
  const [containerWidth, setContainerWidth] = useState(0);
  const [containerHeight, setContainerHeight] = useState(0);
  const scrollX = useSharedValue(0);

  const { totalLength: totalMainLength, webbings: mainWebbingPaths } = useMemo(
    () => computeWebbingSectionData(mainSections, 'main'),
    [mainSections],
  );
  const { totalLength: totalBackupLength, webbings: backupWebbingPaths } =
    useMemo(
      () => computeWebbingSectionData(backupSections, 'backup'),
      [backupSections],
    );
  const totalCanvasWidth = Math.max(
    containerWidth,
    Math.max(totalMainLength, totalBackupLength) + CANVA_PADDING * 2,
  );

  // Run validations on the current setup:
  const mainValidationError = useMemo(
    () =>
      validateSectionLoops({
        webbings: mainSections,
        type: 'main',
        highlineLength,
      }),
    [mainSections, highlineLength],
  );
  const backupValidationError = useMemo(
    () =>
      validateSectionLoops({
        webbings: backupSections,
        type: 'backup',
        highlineLength,
      }),
    [backupSections, highlineLength],
  );
  const connectionValidationError = useMemo(
    () => validateConnections({ main: mainSections, backup: backupSections }),
    [mainSections, backupSections],
  );

  // Call the callback whenever errors change
  useEffect(() => {
    if (onValidationError) {
      onValidationError({
        main: mainValidationError || undefined,
        backup: backupValidationError || undefined,
        connection: connectionValidationError || undefined,
      });
    }
  }, [
    mainValidationError,
    backupValidationError,
    connectionValidationError,
    onValidationError,
  ]);

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollX.value = event.contentOffset.x;
    },
  });

  const handleFocusWebbing = React.useCallback(
    (type: WebType, index: number) => {
      if (focusedWebbing?.type === type && focusedWebbing?.index === index) {
        setFocusedWebbing(null);
        return;
      }
      setFocusedWebbing({
        type,
        index,
      });
    },
    [form, focusedWebbing],
  );

  return (
    <View
      className="relative w-full h-64"
      onLayout={(event) => {
        const { width, height } = event.nativeEvent.layout;
        setContainerWidth(width);
        setContainerHeight(height);
      }}
    >
      <CanvasGrid width={containerWidth} height={containerHeight} />

      <ScrollableCanvas
        width={totalCanvasWidth}
        height={containerHeight}
        scrollHandler={scrollHandler}
        containerWidth={containerWidth}
        containerHeight={containerHeight}
        onTapEnd={() => {
          if (!focusedWebbing) return;
          setFocusedWebbing(null);
        }}
      >
        <WebSection
          type="main"
          paths={mainWebbingPaths}
          focusedType={focusedWebbing?.type || null}
          focusedIndex={focusedWebbing?.index ?? null}
        />
        <WebSection
          type="backup"
          paths={backupWebbingPaths}
          focusedType={focusedWebbing?.type || null}
          focusedIndex={focusedWebbing?.index ?? null}
        />
      </ScrollableCanvas>

      {mainWebbingPaths.map(({ path }, index) => (
        <WebPathGestureHandler
          type="main"
          key={`main-${index}`}
          path={path}
          scrollX={scrollX}
          onTap={() => {
            handleFocusWebbing('main', index);
          }}
        />
      ))}
      {backupWebbingPaths.map(({ path }, index) => (
        <WebPathGestureHandler
          type="backup"
          key={`backup-${index}`}
          path={path}
          scrollX={scrollX}
          onTap={() => {
            handleFocusWebbing('backup', index);
          }}
        />
      ))}
    </View>
  );
};

function computeWebbingSectionData(
  sections: WebbingWithId[],
  type: 'main' | 'backup',
) {
  const SQUARE_SIZE = 10;
  const webbings: Array<{
    path: SkPath;
    leftLoopPath: { path: SkPath; color: string } | null;
    rightLoopPath: { path: SkPath; color: string } | null;
  }> = [];
  let currentX = CANVA_PADDING;
  let totalLength = 0;

  // Pre-process effective loops for all sections
  const effectiveLoops = sections.map((curr, i) => {
    let effectiveLeft = curr.leftLoop;
    let effectiveRight = curr.rightLoop;
    const totalLoops = Number(curr.leftLoop) + Number(curr.rightLoop);

    if (i === 0 && totalLoops === 1) {
      effectiveLeft = false;
      effectiveRight = true;
    } else if (i === sections.length - 1 && totalLoops === 1) {
      effectiveLeft = true;
      effectiveRight = false;
    }

    return { effectiveLeft, effectiveRight };
  });

  // Detect intersections based on EFFECTIVE loops
  const intersectingIndices = new Set<number>();
  for (let i = 0; i < sections.length - 1; i++) {
    const current = effectiveLoops[i];
    const next = effectiveLoops[i + 1];

    if (current.effectiveRight && next.effectiveLeft) {
      intersectingIndices.add(i);
      intersectingIndices.add(i + 1);
    }
  }

  // Generate paths
  for (let i = 0; i < sections.length; i++) {
    totalLength += Number(sections[i].length);
    const pathWidth = Number(sections[i].length);
    const endX = currentX + pathWidth;
    const middleX = currentX + pathWidth / 2;
    const startY = type === 'main' ? 100 : 120;

    // Use precomputed effective loops
    const { effectiveLeft, effectiveRight } = effectiveLoops[i];

    // Loop creation with color detection
    const createLoop = (x: number, isLeft: boolean) => {
      const isIntersecting = intersectingIndices.has(i);
      const isConnectionPoint = isLeft
        ? i > 0 && effectiveLoops[i - 1].effectiveRight
        : i < sections.length - 1 && effectiveLoops[i + 1].effectiveLeft;

      return {
        path: Skia.Path.Make().addRect(
          Skia.XYWHRect(
            x - SQUARE_SIZE / 2,
            startY - SQUARE_SIZE / 2,
            SQUARE_SIZE,
            SQUARE_SIZE,
          ),
        ),
        color: isConnectionPoint && isIntersecting ? '#22c55e' : '#000000',
      };
    };

    const linePath = Skia.Path.Make();
    linePath.moveTo(currentX, startY);

    if (type === 'main') {
      linePath.lineTo(endX, startY);
    } else {
      linePath.quadTo(middleX, startY + 100, endX, startY);
    }

    webbings.push({
      path: linePath,
      leftLoopPath: effectiveLeft ? createLoop(currentX, true) : null,
      rightLoopPath: effectiveRight ? createLoop(endX, false) : null,
    });

    currentX = endX;
  }

  return { webbings, totalLength };
}

export const ScrollableCanvas = ({
  width,
  height,
  containerWidth,
  containerHeight,
  scrollHandler,
  onTapEnd,
  children,
}: {
  width: number;
  height: number;
  containerWidth: number;
  containerHeight: number;
  scrollHandler: ReturnType<typeof useAnimatedScrollHandler>;
  onTapEnd: () => void;
  children: React.ReactNode;
}) => {
  const scale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedScale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  const tapGesture = Gesture.Tap()
    .runOnJS(true)
    .onEnd(() => {
      onTapEnd();
    });

  const pinchGesture = Gesture.Pinch()
    .onStart(() => {
      savedScale.value = scale.value;
    })
    .onUpdate((event) => {
      const scaledWidth = containerWidth * savedScale.value * event.scale;
      const scaledHeight = containerHeight * savedScale.value * event.scale;

      // Calculate the minimum scale that keeps the canvas at least the size of the container
      const minScaleWidth = containerWidth / scaledWidth;
      const minScaleHeight = containerHeight / scaledHeight;
      const minScale = Math.max(minScaleWidth, minScaleHeight, 1); // 1 ensures we don't shrink below the container size

      // Calculate the new scale, clamped to [minScale, maxScale]
      const newScale = Math.max(
        minScale,
        Math.min(savedScale.value * event.scale, 3),
      );

      scale.value = newScale;
    });

  const doubleTapGesture = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      scale.value = withTiming(1, { duration: 200 });
      translateX.value = withTiming(0, { duration: 200 });
      translateY.value = withTiming(0, { duration: 200 });
    });

  const composedGesture = Gesture.Simultaneous(
    tapGesture,
    pinchGesture,
    doubleTapGesture,
  );

  return (
    <GestureDetector gesture={composedGesture}>
      <Animated.View style={animatedStyle}>
        <Animated.ScrollView
          horizontal
          showsHorizontalScrollIndicator
          scrollEventThrottle={16}
          onScroll={scrollHandler}
          contentContainerStyle={{ minWidth: width }}
        >
          <Canvas
            style={{
              width: width || 1, // Ensure non-zero width
              height: height || 1, // Ensure non-zero height
            }}
          >
            {children}
          </Canvas>
        </Animated.ScrollView>
      </Animated.View>
    </GestureDetector>
  );
};

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
