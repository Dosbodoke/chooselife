import { Path, SkPath } from '@shopify/react-native-skia';
import type { WebType } from '~/context/rig-form';
import React from 'react';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  SharedValue,
  useAnimatedStyle,
} from 'react-native-reanimated';

const WEBBING_STROKE_WIDTH = 6;

// The paths that will be rendered inside a Skia Canva
export const WebSection = ({
  type,
  paths,
  focusedType,
  focusedIndex,
}: {
  type: WebType;
  paths: {
    path: SkPath;
    leftLoopPath: {
      path: SkPath;
      color: string;
    } | null;
    rightLoopPath: {
      path: SkPath;
      color: string;
    } | null;
  }[];
  focusedType: WebType | null;
  focusedIndex: number | null;
}) => (
  <>
    {paths.map(({ path, leftLoopPath, rightLoopPath }, index) => {
      const isFocused = focusedType === type && focusedIndex === index;
      return (
        <React.Fragment key={`fragment-${type}-${index}`}>
          <Path
            path={path}
            color={
              focusedIndex !== null && !isFocused
                ? 'gray'
                : type === 'main'
                  ? '#FE5577'
                  : '#3b82f6'
            }
            style="stroke"
            strokeWidth={WEBBING_STROKE_WIDTH}
          />
          {leftLoopPath && (
            <Path
              path={leftLoopPath.path}
              color={leftLoopPath.color}
              style="fill"
            />
          )}
          {rightLoopPath && (
            <Path
              path={rightLoopPath.path}
              color={rightLoopPath.color}
              style="fill"
            />
          )}
        </React.Fragment>
      );
    })}
  </>
);

// Absolute view that will be rendered over <WebSection /> to make it interactable
export const WebPathGestureHandler = ({
  type,
  path,
  scrollX,
  onTap,
}: {
  type: WebType;
  path: SkPath;
  scrollX: SharedValue<number>;
  onTap: () => void;
}) => {
  const pathBounds = path.getBounds();
  const tapGesture = Gesture.Tap()
    .onBegin(() => {
      onTap();
    })
    .runOnJS(true);

  // Because this absolutely-positioned `View` moves relative to scroll,
  // we subtract the scrollX from the left value to keep in sync.
  const style = useAnimatedStyle(() => ({
    position: 'absolute',
    width: pathBounds.width,
    height: type === 'main' ? WEBBING_STROKE_WIDTH : pathBounds.height / 2,
    top: pathBounds.y - WEBBING_STROKE_WIDTH / 2,
    left: pathBounds.x - scrollX.value,
  }));

  return (
    <GestureDetector gesture={tapGesture}>
      <Animated.View style={style} />
    </GestureDetector>
  );
};
