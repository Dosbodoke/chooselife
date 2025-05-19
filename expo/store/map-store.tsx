import Mapbox from '@rnmapbox/maps';
import { BBox, Position } from 'geojson';
import { create } from 'zustand';

import { Highline } from '~/hooks/use-highline';
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
  // Keep track of the handle height so the Highlited marker card can be positioned correctly and the minimum snap point fits only the handler
  bottomSheetHandlerHeight: number;
  // Keep track of the handle height so the Highlited marker card can be positioned correctly and the minimum snap point fits only the handler
  exploreHeaderHeight: number;
};

type Actions = {
  setCamera: (camera: Mapbox.MapState) => void;
  setBottomSheeHandlerHeight: (height: number) => void;
  setExploreHeaderHeight: (height: number) => void;
  setHighlightedMarker: (marker: Highline | null) => void;
  setClusteredMarkers: (markers: Highline[]) => void;
};

export const useMapStore = create<State & Actions>((set) => ({
  camera: {
    zoom: DEFAULT_ZOOM,
    center: [DEFAULT_LONGITUDE, DEFAULT_LATITUDE],
    bounds: regionToBoundingBox(INITIAL_REGION),
  },
  highlightedMarker: null,
  clusteredMarkers: [],
  exploreHeaderHeight: 0,
  bottomSheetHandlerHeight: 0,
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
  setExploreHeaderHeight: (height: number) => {
    set(() => ({
      exploreHeaderHeight: height,
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
}));
