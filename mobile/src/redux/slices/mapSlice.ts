import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { Coordinates } from '@src/database';

import { RootState } from '../store';

export interface HighlitedMarker {
  type: 'Highline';
  id: string;
  coords: Coordinates[];
}

export type MapType = 'standard' | 'satellite' | 'terrain';

interface MapState {
  highlitedMarker: HighlitedMarker | null;
  mapType: MapType;
}

const initialState: MapState = {
  highlitedMarker: null,
  mapType: 'standard',
};

export const mapSlice = createSlice({
  name: 'map',
  initialState,
  reducers: {
    highliteMarker: (state, action: PayloadAction<HighlitedMarker>) => {
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
  },
});

export const { highliteMarker, minimizeMarker, setMapType } = mapSlice.actions;

// Selectors
export const selectHighlitedMarker = (state: RootState) => state.map.highlitedMarker;
export const selectMapType = (state: RootState) => state.map.mapType;

export default mapSlice.reducer;
