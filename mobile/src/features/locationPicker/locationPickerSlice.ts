import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { RootState } from '@src/redux/store';
import { LatLng } from 'react-native-maps';

interface LocationPicker {
  type: 'Highline';
  stage: 'hidden' | 'picking';
  anchorA: LatLng | null;
  shouldCallSetPoint: boolean;
}

const initialState: LocationPicker = {
  type: 'Highline',
  stage: 'hidden',
  anchorA: null,
  shouldCallSetPoint: false,
};

export const locationPickerSlice = createSlice({
  name: 'locationPicker',
  initialState,
  reducers: {
    showLocationPicker: (state) => {
      state.stage = 'picking';
      state.anchorA = null;
    },
    setPoint: (state, action: PayloadAction<LatLng | null>) => {
      if (state.anchorA) {
        state.stage = 'hidden';
      } else {
        state.stage = 'picking';
        state.anchorA = action?.payload ?? null;
      }
      state.shouldCallSetPoint = false;
    },
    callSetPoint: (state) => {
      state.shouldCallSetPoint = true;
    },
  },
});

export const { showLocationPicker, setPoint, callSetPoint } = locationPickerSlice.actions;

// Selectors
export const selectLocationPicker = (state: RootState) => state.locationPicker;

export default locationPickerSlice.reducer;
