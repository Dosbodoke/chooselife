import Mapbox from '@rnmapbox/maps';
import {
  getMapExperimentVariant,
  getMapStyleStorage,
} from '~/features/growth/analytics';
import {
  MAP_PREFERENCE_KEY,
  resolveMapDefault,
  type MapDefault,
  type MapType,
} from '~/features/growth/map-default';
import { useCallback, useState } from 'react';

import { useMountEffect } from '~/hooks/use-mount-effect';

export type { MapType } from '~/features/growth/map-default';

/**
 * Custom hook to manage map style state with persistent storage
 * @returns Object containing mapType, setMapType function, mapStyle URL, and loading state
 */
export const useMapStyle = () => {
  const [storage] = useState(getMapStyleStorage);
  const [state, setState] = useState<MapDefault>({
    mapType: 'standard',
    assignment: null,
  });
  const { mapType, assignment } = state;
  const [isLoading, setIsLoading] = useState(true);

  useMountEffect(() => {
    let mounted = true;
    void resolveMapDefault(storage, getMapExperimentVariant).then(
      (resolved) => {
        if (!mounted) return;
        setState(resolved);
        setIsLoading(false);
      },
    );
    return () => {
      mounted = false;
    };
  });

  const setMapType = useCallback(
    async (newMapType: MapType) => {
      try {
        setState((current) => ({ ...current, mapType: newMapType }));
        await storage.setItem(MAP_PREFERENCE_KEY, newMapType);
      } catch (error) {
        console.error('Error saving map type preference:', error);
      }
    },
    [storage],
  );

  const mapStyle =
    mapType === 'satellite'
      ? Mapbox.StyleURL.SatelliteStreet
      : Mapbox.StyleURL.Outdoors;

  return {
    mapType,
    assignment,
    setMapType,
    mapStyle,
    isLoading,
  };
};
