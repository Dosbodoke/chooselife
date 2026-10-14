import { useFocusEffect } from 'expo-router';
import { useCallback, useLayoutEffect, useRef } from 'react';
import { AppState } from 'react-native';

import { captureGrowthEvent, flushGrowthEvents } from './analytics';
import { ExploreVisit } from './explore-visit';
import type { MapDefault, MapType } from './map-default';

export function useExploreVisit(state: MapDefault, mapReady: boolean) {
  const visitRef = useRef<ExploreVisit | null>(null);
  const stateRef = useRef(state);
  // External lifecycle callbacks should see committed state, never an abandoned render.
  useLayoutEffect(() => {
    stateRef.current = state;
  }, [state]);

  useFocusEffect(
    useCallback(() => {
      if (!mapReady) return;
      let heartbeat: ReturnType<typeof setInterval> | undefined;
      const stop = () => {
        clearInterval(heartbeat);
        visitRef.current?.end();
        visitRef.current = null;
        flushGrowthEvents();
      };
      const start = () => {
        if (visitRef.current || AppState.currentState !== 'active') return;
        visitRef.current = new ExploreVisit(
          stateRef.current,
          captureGrowthEvent,
        );
        heartbeat = setInterval(() => visitRef.current?.flush(), 15_000);
      };
      start();
      const subscription = AppState.addEventListener('change', (next) => {
        if (next === 'active') start();
        else stop();
      });
      return () => {
        subscription.remove();
        stop();
      };
    }, [mapReady]),
  );

  return {
    interact: useCallback(() => visitRef.current?.interact(), []),
    openHighline: useCallback(
      (source: 'list' | 'map_card') => visitRef.current?.openHighline(source),
      [],
    ),
    changeMapType: useCallback(
      (next: MapType) => visitRef.current?.changeMapType(next),
      [],
    ),
  };
}
