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
}));
