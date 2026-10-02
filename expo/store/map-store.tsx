import Mapbox from '@rnmapbox/maps';
import type { AnchorPosition } from '~/features/highline-registration/state/model';
import type { PendingMapLineProjection } from '~/features/highline-registration/state/selectors';
import { create } from 'zustand';

import { Highline, HighlineCategory } from '~/hooks/use-highline';
import {
  DEFAULT_LATITUDE,
  DEFAULT_LONGITUDE,
  DEFAULT_ZOOM,
  INITIAL_REGION,
} from '~/utils/constants';

import { regionToBoundingBox } from '~/components/map/utils';

import { nextCameraState, type CameraState } from './camera-state';

type State = {
  camera: CameraState;
  userLocation: {
    latitude: number;
    longitude: number;
  } | null;
  highlightedMarker: Highline | null;
  clusteredMarkers: Highline[];
  bottomSheetHandlerHeight: number;
  // Search/filter state
  searchQuery: string;
  activeCategory: HighlineCategory | null;
  locationPickerRequest: LocationPickerRequest | null;
  locationPickerSession: LocationPickerSession | null;
};

export type LocationPickerRequest =
  | {
      requestId: string;
      kind: 'new';
      center?: AnchorPosition;
      zoom?: number;
    }
  | {
      requestId: string;
      kind: 'edit';
      highlineId: string;
      anchorA: AnchorPosition | null;
      anchorB: AnchorPosition | null;
    };

export type LocationPickerStage = 'place-a' | 'place-b' | 'review' | 'adjust';

export type LocationPickerSession = {
  stage: LocationPickerStage;
  adjustingAnchor: 'a' | 'b' | null;
  anchorA: AnchorPosition | null;
  anchorB: AnchorPosition | null;
  pendingLines: PendingMapLineProjection[];
  existingHighlinesVisible: boolean;
};

type Actions = {
  setCamera: (camera: Mapbox.MapState) => void;
  setUserLocation: (
    location: {
      latitude: number;
      longitude: number;
    } | null,
  ) => void;
  setBottomSheeHandlerHeight: (height: number) => void;
  setHighlightedMarker: (marker: Highline | null) => void;
  setClusteredMarkers: (markers: Highline[]) => void;
  setSearchQuery: (query: string) => void;
  setActiveCategory: (category: HighlineCategory | null) => void;
  requestLocationPicker: (request: LocationPickerRequestInput) => void;
  clearLocationPickerRequest: () => void;
  setLocationPickerSession: (session: LocationPickerSession | null) => void;
};

export type LocationPickerRequestInput =
  | {
      requestId?: string;
      kind: 'new';
      center?: AnchorPosition;
      zoom?: number;
    }
  | {
      requestId?: string;
      kind: 'edit';
      highlineId: string;
      anchorA: AnchorPosition | null;
      anchorB: AnchorPosition | null;
    };

export const useMapStore = create<State & Actions>((set) => ({
  camera: {
    zoom: DEFAULT_ZOOM,
    center: [DEFAULT_LONGITUDE, DEFAULT_LATITUDE],
    bounds: regionToBoundingBox(INITIAL_REGION),
  },
  userLocation: null,
  highlightedMarker: null,
  clusteredMarkers: [],
  bottomSheetHandlerHeight: 0,
  searchQuery: '',
  activeCategory: null,
  locationPickerRequest: null,
  locationPickerSession: null,
  setCamera: (state: Mapbox.MapState) => {
    // `nextCameraState` returns the previous slice verbatim when the camera did
    // not really move, which is what keeps `onCameraChanged` from re-rendering
    // the entire map subtree a few times a second while the map sits still.
    set((current) => {
      const camera = nextCameraState(current.camera, state);

      return camera === current.camera ? current : { camera };
    });
  },
  setUserLocation: (location) => {
    set(() => ({
      userLocation: location,
    }));
  },
  setBottomSheeHandlerHeight: (height: number) => {
    set(() => ({
      bottomSheetHandlerHeight: height,
    }));
  },
  setHighlightedMarker: (marker: Highline | null) => {
    set(() => ({
      highlightedMarker: marker,
    }));
  },
  setClusteredMarkers: (markers: Highline[]) => {
    set(() => ({
      clusteredMarkers: markers,
    }));
  },
  setSearchQuery: (query: string) => {
    set(() => ({
      searchQuery: query,
    }));
  },
  setActiveCategory: (category: HighlineCategory | null) => {
    set(() => ({
      activeCategory: category,
    }));
  },
  requestLocationPicker: (request) => {
    set(() => ({
      locationPickerRequest: {
        ...request,
        requestId: request.requestId ?? `${Date.now()}-${Math.random()}`,
      } as LocationPickerRequest,
    }));
  },
  clearLocationPickerRequest: () => {
    set(() => ({
      locationPickerRequest: null,
      locationPickerSession: null,
    }));
  },
  setLocationPickerSession: (session) => {
    set(() => ({
      locationPickerSession: session,
    }));
  },
}));

/**
 * Non-hook snapshot of the camera center, for seeding refs during render
 * without referencing `useMapStore` as a value (which the React Compiler
 * rejects).
 */
export function getMapCameraCenter() {
  return useMapStore.getState().camera.center;
}
