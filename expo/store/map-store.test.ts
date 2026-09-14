import type { Position } from 'geojson';

import { useMapStore } from './map-store';

jest.mock('@rnmapbox/maps', () => ({
  __esModule: true,
  default: {},
}));

jest.mock('react-native-reanimated', () => ({
  LinearTransition: {
    springify: () => ({
      damping: () => ({}),
    }),
  },
}));

type CameraEvent = Parameters<
  ReturnType<typeof useMapStore.getState>['setCamera']
>[0];

const eventFor = (
  camera: ReturnType<typeof useMapStore.getState>['camera'],
  overrides: {
    center?: Position;
    zoom?: number;
    sw?: Position;
    ne?: Position;
  } = {},
): CameraEvent =>
  ({
    properties: {
      center: overrides.center ?? camera.center,
      zoom: overrides.zoom ?? camera.zoom,
      bounds: {
        sw: overrides.sw ?? [camera.bounds[0], camera.bounds[1]],
        ne: overrides.ne ?? [camera.bounds[2], camera.bounds[3]],
      },
    },
  }) as CameraEvent;

let unsubscribe: (() => void) | undefined;

const resetStore = () => {
  useMapStore.setState(useMapStore.getInitialState(), true);
};

beforeEach(() => {
  resetStore();
});

afterEach(() => {
  unsubscribe?.();
  unsubscribe = undefined;
  resetStore();
  jest.clearAllMocks();
});

describe('useMapStore setCamera', () => {
  it('keeps the store root stable for no-op events and notifies once for a move', () => {
    const initialRoot = useMapStore.getState();
    const initialCamera = initialRoot.camera;
    const initialSearchQuery = initialRoot.searchQuery;
    const initialUserLocation = initialRoot.userLocation;
    const setCamera = initialRoot.setCamera;
    const initialClusteredMarkers = initialRoot.clusteredMarkers;
    const setUserLocation = initialRoot.setUserLocation;
    const setBottomSheeHandlerHeight = initialRoot.setBottomSheeHandlerHeight;
    const setHighlightedMarker = initialRoot.setHighlightedMarker;
    const setClusteredMarkers = initialRoot.setClusteredMarkers;
    const setSearchQuery = initialRoot.setSearchQuery;
    const setActiveCategory = initialRoot.setActiveCategory;
    const listener = jest.fn();
    unsubscribe = useMapStore.subscribe(listener);

    const identicalEvent = eventFor(initialCamera);
    setCamera(identicalEvent);
    setCamera(identicalEvent);
    expect(useMapStore.getState()).toBe(initialRoot);

    const noisyEvent = eventFor(initialCamera, {
      center: [initialCamera.center[0] + 1e-9, initialCamera.center[1] - 1e-9],
      zoom: initialCamera.zoom + 1e-7,
    });
    setCamera(noisyEvent);
    setCamera(noisyEvent);
    expect(useMapStore.getState()).toBe(initialRoot);

    const invalidEvent = {
      properties: {
        center: [Number.NaN, initialCamera.center[1]],
        zoom: initialCamera.zoom,
        bounds: {
          sw: [initialCamera.bounds[0], initialCamera.bounds[1]],
          ne: [initialCamera.bounds[2], initialCamera.bounds[3]],
        },
      },
    } as unknown as CameraEvent;
    setCamera(invalidEvent);
    setCamera(invalidEvent);
    expect(useMapStore.getState()).toBe(initialRoot);
    expect(listener).not.toHaveBeenCalled();

    setCamera(
      eventFor(initialCamera, {
        center: [initialCamera.center[0] + 0.01, initialCamera.center[1]],
        zoom: initialCamera.zoom + 1,
        sw: [initialCamera.bounds[0] + 0.01, initialCamera.bounds[1]],
        ne: [initialCamera.bounds[2] + 0.01, initialCamera.bounds[3]],
      }),
    );

    const movedRoot = useMapStore.getState();
    expect(listener).toHaveBeenCalledTimes(1);
    expect(movedRoot).not.toBe(initialRoot);
    expect(movedRoot.camera).toEqual({
      center: [initialCamera.center[0] + 0.01, initialCamera.center[1]],
      zoom: initialCamera.zoom + 1,
      bounds: [
        initialCamera.bounds[0] + 0.01,
        initialCamera.bounds[1],
        initialCamera.bounds[2] + 0.01,
        initialCamera.bounds[3],
      ],
    });
    expect(movedRoot.searchQuery).toBe(initialSearchQuery);
    expect(movedRoot.userLocation).toBe(initialUserLocation);
    expect(movedRoot.clusteredMarkers).toBe(initialClusteredMarkers);
    expect(movedRoot.setCamera).toBe(setCamera);
    expect(movedRoot.setUserLocation).toBe(setUserLocation);
    expect(movedRoot.setBottomSheeHandlerHeight).toBe(
      setBottomSheeHandlerHeight,
    );
    expect(movedRoot.setHighlightedMarker).toBe(setHighlightedMarker);
    expect(movedRoot.setClusteredMarkers).toBe(setClusteredMarkers);
    expect(movedRoot.setSearchQuery).toBe(setSearchQuery);
    expect(movedRoot.setActiveCategory).toBe(setActiveCategory);

    const [notifiedRoot, previousRoot] = listener.mock.calls[0];
    expect(notifiedRoot).toBe(movedRoot);
    expect(previousRoot).toBe(initialRoot);
  });
});
