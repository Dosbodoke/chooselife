import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { Coordinates } from '@src/database';

import { RootState } from '../store';

interface HighliteMarkerPayload {
  type: 'Highline';
  id: string;
  coords: Coordinates[];
}

interface MarkerState {
  highlitedMarker: HighliteMarkerPayload | null;
}

const initialState: MarkerState = {
  highlitedMarker: null,
};

export const markerSlice = createSlice({
  name: 'marker',
  initialState,
  reducers: {
    highliteMarker: (state, action: PayloadAction<HighliteMarkerPayload>) => {
      state.highlitedMarker = {
        type: 'Highline',
        id: action.payload.id,
        coords: action.payload.coords,
      };
    },
    minimizeMarker: (state) => {
      state.highlitedMarker = null;
    },
  },
});

export const { highliteMarker, minimizeMarker } = markerSlice.actions;
export const selectHighlitedMarker = (state: RootState) => state.marker.highlitedMarker;

export default markerSlice.reducer;
