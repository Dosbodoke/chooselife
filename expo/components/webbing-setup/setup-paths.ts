// Skia paths for a setup drawing, shared by the rig form canvas and the
// read-only canvas. Kept out of the component files so Fast Refresh works.

import { Skia, SkPath } from '@shopify/react-native-skia';

import type { WebbingWithId } from '~/context/rig-form';

export const CANVA_PADDING = 50;

export function computeWebbingSectionData(
  sections: Pick<WebbingWithId, 'length' | 'leftLoop' | 'rightLoop'>[],
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
