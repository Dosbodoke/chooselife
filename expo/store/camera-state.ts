import type { BBox, Position } from 'geojson';

export type CameraState = {
  zoom: number;
  center: Position;
  bounds: BBox;
};

/**
 * The structural part of `Mapbox.MapState` this reducer reads. Declared locally
 * so the module stays free of native imports and can be unit tested.
 */
export type CameraChangeEvent = {
  properties: {
    center: Position;
    bounds: { ne: Position; sw: Position };
    zoom: number;
  };
};

/**
 * ~11cm at the equator.
 *
 * The map re-emits its resting position after every gesture and after every
 * programmatic `flyTo`, and the native payload carries float noise far below
 * this. Anything under this threshold is not a real move, so treating it as one
 * only invalidates every memo downstream.
 */
const COORDINATE_EPSILON = 1e-6;

/** Well below the whole-zoom-level granularity Supercluster buckets on. */
const ZOOM_EPSILON = 1e-3;

/**
 * ~22m. How far the map centre may sit from the user before the locate control
 * stops claiming we are on their location. Roughly 20 screen points at the zoom
 * `goToMyLocation` settles on, so a deliberate drag releases it but the jitter
 * at the tail of the flight does not.
 */
const ON_LOCATION_TOLERANCE = 2e-4;

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

const isPosition = (value: unknown): value is Position => {
  if (!Array.isArray(value) || value.length < 2) return false;

  for (const coordinate of value) {
    if (!isFiniteNumber(coordinate)) return false;
  }

  return true;
};

const positionsEqual = (a: Position, b: Position) =>
  Math.abs(a[0] - b[0]) < COORDINATE_EPSILON &&
  Math.abs(a[1] - b[1]) < COORDINATE_EPSILON;

const boundsEqual = (a: BBox, b: BBox) =>
  Math.abs(a[0] - b[0]) < COORDINATE_EPSILON &&
  Math.abs(a[1] - b[1]) < COORDINATE_EPSILON &&
  Math.abs(a[2] - b[2]) < COORDINATE_EPSILON &&
  Math.abs(a[3] - b[3]) < COORDINATE_EPSILON;

/**
 * Fold a camera-change event into the stored camera slice, preserving
 * references wherever the underlying values did not actually change.
 *
 * Every subscriber to `state.camera` re-renders when this returns a new object,
 * and `onCameraChanged` fires several times a second during any pan, so the
 * referential contract here is what bounds the whole map subtree's render count:
 *
 * - a no-op event returns `previous` unchanged, so nothing re-renders at all;
 * - a move that only changes the zoom keeps the previous `center` and `bounds`
 *   arrays, so selectors reading just those stay put (and vice versa).
 *
 * A malformed payload is discarded rather than written, so a bad native event
 * can never replace a good camera with `NaN`s.
 */
export function nextCameraState(
  previous: CameraState,
  event: CameraChangeEvent,
): CameraState {
  const properties = event?.properties;
  if (!properties) return previous;

  const { center, bounds, zoom } = properties;

  if (!isPosition(center) || !isFiniteNumber(zoom)) return previous;
  if (!bounds || !isPosition(bounds.sw) || !isPosition(bounds.ne)) {
    return previous;
  }

  const nextBounds: BBox = [
    bounds.sw[0],
    bounds.sw[1],
    bounds.ne[0],
    bounds.ne[1],
  ];

  const nextCenter = positionsEqual(previous.center, center)
    ? previous.center
    : center;
  const nextZoom =
    Math.abs(previous.zoom - zoom) < ZOOM_EPSILON &&
    Math.floor(previous.zoom) === Math.floor(zoom)
      ? previous.zoom
      : zoom;
  const resolvedBounds = boundsEqual(previous.bounds, nextBounds)
    ? previous.bounds
    : nextBounds;

  if (
    nextCenter === previous.center &&
    nextZoom === previous.zoom &&
    resolvedBounds === previous.bounds
  ) {
    return previous;
  }

  return { center: nextCenter, zoom: nextZoom, bounds: resolvedBounds };
}

/**
 * Whether the map is centred closely enough on `target` to call it "on my
 * location".
 *
 * Derived from where the camera actually is rather than from a timer started
 * when the flight began: the camera handler is throttled, so any deadline set
 * at call time can be evaluated after it has already passed, and the flag gets
 * cleared mid-flight. Position has no such race, and it also releases the flag
 * for free when something else moves the camera away.
 */
export function isCameraOnLocation(
  center: Position,
  target: Position | null,
): boolean {
  if (!target) return false;
  if (!isPosition(center) || !isPosition(target)) return false;

  return (
    Math.abs(center[0] - target[0]) < ON_LOCATION_TOLERANCE &&
    Math.abs(center[1] - target[1]) < ON_LOCATION_TOLERANCE
  );
}
