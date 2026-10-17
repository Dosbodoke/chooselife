import { useWindowDimensions } from 'react-native';

export const GRID_COLUMNS = 2;
export const GRID_GAP = 12;
/** px-4 on each side of the sheet content. */
export const GRID_PADDING = 16;

/** Width of one cell in the two-column grid, tracking the window size. */
export function useGridItemWidth() {
  const { width } = useWindowDimensions();
  return (
    (width - GRID_PADDING * 2 - (GRID_COLUMNS - 1) * GRID_GAP) / GRID_COLUMNS
  );
}

/** Width of a full-row card. */
export function useRowItemWidth() {
  const { width } = useWindowDimensions();
  return width - GRID_PADDING * 2;
}
