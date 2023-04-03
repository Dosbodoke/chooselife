import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { RootState } from '@src/redux/store';
import { Camera, type LatLng } from 'react-native-maps';

export interface HighlitedMarker {
  type: 'Highline';
  id: string;
  coords: LatLng[];
  shouldTriggerUseQueryRefetch?: boolean;
}

export type MapType = 'standard' | 'satellite' | 'terrain';

interface MapState {
  highlitedMarker: HighlitedMarker | null;
  mapType: MapType;
  camera: Camera | null;
  updateCenterCoordinates: boolean;
}

const initialState: MapState = {
  highlitedMarker: null,
  mapType: 'standard',
  camera: null,
  updateCenterCoordinates: false,
};

export const mapSlice = createSlice({
  name: 'map',
  initialState,
  reducers: {
    highlightMarker: (state, action: PayloadAction<HighlitedMarker>) => {
      const { id, coords, shouldTriggerUseQueryRefetch } = action.payload;
      state.highlitedMarker = {
        type: 'Highline',
        id: id,
        coords: coords,
        shouldTriggerUseQueryRefetch: shouldTriggerUseQueryRefetch,
      };
    },
    minimizeMarker: (state) => {
      state.highlitedMarker = null;
    },
    setMapType: (state, action: PayloadAction<MapType>) => {
      state.mapType = action.payload;
    },
  },
});

export const { highlightMarker, minimizeMarker, setMapType } = mapSlice.actions;

// Selectors
export const selectHighlitedMarker = (state: RootState) => state.map.highlitedMarker;
export const selectMapType = (state: RootState) => state.map.mapType;

export default mapSlice.reducer;
