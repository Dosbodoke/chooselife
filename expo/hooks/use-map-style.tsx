import Mapbox from '@rnmapbox/maps';
import AsyncStorage from 'expo-sqlite/kv-store';
import { useCallback, useEffect, useState } from 'react';

export type MapType = 'satellite' | 'standard';

const MAP_TYPE_STORAGE_KEY = 'preferred_map_type';
const DEFAULT_MAP_TYPE: MapType = 'satellite';

/**
 * Custom hook to manage map style state with persistent storage
 * @returns Object containing mapType, setMapType function, mapStyle URL, and loading state
 */
export const useMapStyle = () => {
  const [mapType, setMapTypeState] = useState<MapType>(DEFAULT_MAP_TYPE);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadMapType = async () => {
      try {
        const savedMapType = await AsyncStorage.getItem(MAP_TYPE_STORAGE_KEY);
        if (
          savedMapType &&
          (savedMapType === 'satellite' || savedMapType === 'standard')
        ) {
          setMapTypeState(savedMapType as MapType);
        }
      } catch (error) {
        console.error('Error loading map type preference:', error);
        // Fall back to default if loading fails
        setMapTypeState(DEFAULT_MAP_TYPE);
      } finally {
        setIsLoading(false);
      }
    };

    loadMapType();
  }, []);

  const setMapType = useCallback(async (newMapType: MapType) => {
    try {
      setMapTypeState(newMapType);
      await AsyncStorage.setItem(MAP_TYPE_STORAGE_KEY, newMapType);
    } catch (error) {
      console.error('Error saving map type preference:', error);
    }
  }, []);

  const mapStyle =
    mapType === 'satellite'
      ? Mapbox.StyleURL.SatelliteStreet
      : Mapbox.StyleURL.Outdoors;

  return {
    mapType,
    setMapType,
    mapStyle,
    isLoading,
  };
};
