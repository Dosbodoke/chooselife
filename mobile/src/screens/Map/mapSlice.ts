import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { INITIAL_REGION } from '@src/constants';
import { Coordinates } from '@src/database';
import { RootState } from '@src/redux/store';
import { Camera } from 'react-native-maps';

export interface HighlitedMarker {
  type: 'Highline';
  id: string;
  coords: Coordinates[];
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
      state.highlitedMarker = {
        type: 'Highline',
        id: action.payload.id,
        coords: action.payload.coords,
      };
    },
    minimizeMarker: (state) => {
      state.highlitedMarker = null;
    },
    setMapType: (state, action: PayloadAction<MapType>) => {
      state.mapType = action.payload;
    },
    requestUpdateCamera: (state) => {
      state.updateCenterCoordinates = true;
    },
  },
});

export const { highlightMarker, minimizeMarker, setMapType, requestUpdateCamera } =
  mapSlice.actions;

// Selectors
export const selectHighlitedMarker = (state: RootState) => state.map.highlitedMarker;
export const selectMapType = (state: RootState) => state.map.mapType;
export const selectCamera = (state: RootState) => state.map.camera;

export default mapSlice.reducer;
