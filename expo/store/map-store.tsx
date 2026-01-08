import Mapbox from '@rnmapbox/maps';
import { BBox, Position } from 'geojson';
import { create } from 'zustand';

import { Highline, HighlineCategory } from '~/hooks/use-highline';
import {
  DEFAULT_LATITUDE,
  DEFAULT_LONGITUDE,
  DEFAULT_ZOOM,
  INITIAL_REGION,
} from '~/utils/constants';

import { regionToBoundingBox } from '~/components/map/utils';

type State = {
  camera: {
    zoom: number;
    center: Position;
    bounds: BBox;
  };
  highlightedMarker: Highline | null;
  clusteredMarkers: Highline[];
  bottomSheetHandlerHeight: number;
  expandBottomSheet: (() => void) | null;
  // Search/filter state
  searchQuery: string;
  activeCategory: HighlineCategory | null;
  hasFocusedMarker: boolean;
};

type Actions = {
  setCamera: (camera: Mapbox.MapState) => void;
  setBottomSheeHandlerHeight: (height: number) => void;
  setHighlightedMarker: (marker: Highline | null) => void;
  setClusteredMarkers: (markers: Highline[]) => void;
  setExpandBottomSheet: (fn: (() => void) | null) => void;
  setSearchQuery: (query: string) => void;
  setActiveCategory: (category: HighlineCategory | null) => void;
  setHasFocusedMarker: (value: boolean) => void;
};

export const useMapStore = create<State & Actions>((set) => ({
  camera: {
    zoom: DEFAULT_ZOOM,
    center: [DEFAULT_LONGITUDE, DEFAULT_LATITUDE],
    bounds: regionToBoundingBox(INITIAL_REGION),
  },
  highlightedMarker: null,
  clusteredMarkers: [],
  bottomSheetHandlerHeight: 0,
  expandBottomSheet: null,
  searchQuery: '',
  activeCategory: null,
  hasFocusedMarker: false,
  setCamera: (state: Mapbox.MapState) => {
    set(() => {
      const { sw, ne } = state.properties.bounds;

      return {
        camera: {
          center: state.properties.center,
          zoom: state.properties.zoom,
          bounds: [sw[0], sw[1], ne[0], ne[1]],
        },
      };
    });
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
  setExpandBottomSheet: (fn: (() => void) | null) => {
    set(() => ({
      expandBottomSheet: fn,
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
  setHasFocusedMarker: (value: boolean) => {
    set(() => ({
      hasFocusedMarker: value,
    }));
  },
}));
