import { combineReducers, configureStore, PreloadedState } from '@reduxjs/toolkit';
import locationPickerReducer from '@src/screens/Map/LocationPickerScreen/locationPickerSlice';
import mapReducer from '@src/screens/Map/mapSlice';

// Create the root reducer independently to obtain the RootState type
const rootReducer = combineReducers({
  map: mapReducer,
  locationPicker: locationPickerReducer,
});

export function setupStore(preloadedState?: PreloadedState<RootState>) {
  return configureStore({
    reducer: rootReducer,
    preloadedState,
  });
}

export type RootState = ReturnType<typeof rootReducer>;
export type AppStore = ReturnType<typeof setupStore>;
export type AppDispatch = AppStore['dispatch'];
