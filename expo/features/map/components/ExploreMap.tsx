import Mapbox from '@rnmapbox/maps';
import { useMapStore } from '~/store/map-store';
import * as Location from 'expo-location';
import { useLocalSearchParams, useRouter } from 'expo-router';
import throttle from 'lodash.throttle';
import React, { Activity, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';
import { useShallow } from 'zustand/react/shallow';

import { useHighline, type Highline } from '~/hooks/use-highline';
import { useMapStyle } from '~/hooks/use-map-style';
import { useOfflineRegion } from '~/hooks/use-offline-region';
import {
  DEFAULT_LATITUDE,
  DEFAULT_LONGITUDE,
  DEFAULT_ZOOM,
} from '~/utils/constants';

import ListingsBottomSheet from '~/components/map/bottom-sheet';
import MapControls from '~/components/map/controls';
import { MapCardList } from '~/components/map/map-card';
import { Markers } from '~/components/map/markers';
import { ChooselifeTrails } from '~/components/map/trail-shape';
import WeatherCrosshair from '~/components/map/weather-crosshair';

async function getMyLocation(): Promise<
  | {
      latitude: number;
      longitude: number;
      latitudeDelta: number;
      longitudeDelta: number;
    }
  | undefined
> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      console.warn('Location permission not granted');
      return;
    }

    let location;
    try {
      location = await Location.getCurrentPositionAsync({});
    } catch (error) {
      console.warn(
        'Error fetching current position, trying last known position',
        error,
      );
      location = await Location.getLastKnownPositionAsync({});
      if (!location) {
        throw new Error('Unable to obtain a location fix');
      }
    }

    const { latitude, longitude } = location.coords;
    return {
      latitude,
      longitude,
      latitudeDelta: 0.1,
      longitudeDelta: 0.1,
    };
  } catch (error) {
    console.error('Error fetching location:', error);
    return;
  }
}

export default function ExploreMap() {
  useOfflineRegion();

  const mapRef = useRef<Mapbox.MapView>(null);
  const cameraRef = useRef<Mapbox.Camera>(null);

  const [isOnMyLocation, setIsOnMyLocation] = useState(false);
  const [isMapReady, setIsMapReady] = useState(false);
  const searchQuery = useMapStore((state) => state.searchQuery);
  const activeCategory = useMapStore((state) => state.activeCategory);
  const setCamera = useMapStore((state) => state.setCamera);
  const setUserLocation = useMapStore((state) => state.setUserLocation);
  const [highlightedMarker, setHighlightedMarker] = useMapStore(
    useShallow((state) => [
      state.highlightedMarker,
      state.setHighlightedMarker,
    ]),
  );
  const [clusteredMarkers, setClusteredMarkers] = useMapStore(
    useShallow((state) => [state.clusteredMarkers, state.setClusteredMarkers]),
  );
  const setHasFocusedMarker = useMapStore((state) => state.setHasFocusedMarker);

  const { focusedMarker } = useLocalSearchParams<{ focusedMarker?: string }>();
  const router = useRouter();
  const hasFocusedMarkerBeenHandled = useRef(false);

  const isMapCardVisible = clusteredMarkers.length > 0;
  const isSheetAvailable = !isMapCardVisible && !focusedMarker;

  useEffect(() => {
    setHasFocusedMarker(!!focusedMarker);
  }, [focusedMarker, setHasFocusedMarker]);

  const { highlines, isLoading } = useHighline({
    searchTerm: searchQuery,
    category: activeCategory,
  });
  const {
    mapType,
    setMapType,
    mapStyle,
    isLoading: isMapStyleLoading,
  } = useMapStyle();

  const highlinesWithLocation = useMemo(() => {
    return highlines.filter(
      (h) =>
        h.anchor_a_lat && h.anchor_a_long && h.anchor_b_lat && h.anchor_b_long,
    );
  }, [highlines]);

  const goToMyLocation = useCallback(async () => {
    const region = await getMyLocation();
    if (!region) return;

    setUserLocation({
      latitude: region.latitude,
      longitude: region.longitude,
    });
    cameraRef.current?.setCamera({
      centerCoordinate: [region.longitude, region.latitude],
      zoomLevel: 5,
      animationDuration: 1000,
      animationMode: 'flyTo',
    });
    setIsOnMyLocation(true);
  }, [setUserLocation]);

  const throttledCameraUpdate = useCallback(
    throttle(
      (state: Mapbox.MapState) => {
        if (isOnMyLocation) {
          setIsOnMyLocation(false);
        }
        setCamera(state);
      },
      500,
      { leading: true, trailing: true },
    ),
    [setCamera, isOnMyLocation],
  );

  const handleCameraChanged = useCallback(
    (state: Mapbox.MapState) => {
      throttledCameraUpdate(state);
    },
    [throttledCameraUpdate],
  );

  const handleMapPress = useCallback(() => {
    if (highlightedMarker) {
      setHighlightedMarker(null);
      setClusteredMarkers([]);
    }
  }, [highlightedMarker, setClusteredMarkers, setHighlightedMarker]);

  const handleMarkerUpdate = useCallback(
    (highlines: Highline[], focused: Highline) => {
      setClusteredMarkers(highlines);
      setHighlightedMarker(focused);
    },
    [setClusteredMarkers, setHighlightedMarker],
  );

  const handleChangeFocusedMarker = useCallback(
    (high: Highline) => {
      setHighlightedMarker(high);
    },
    [setHighlightedMarker],
  );

  useEffect(() => {
    if (
      !focusedMarker ||
      !highlines ||
      highlines.length === 0 ||
      isLoading ||
      !isMapReady
    ) {
      return;
    }

    const highlineToFocus = highlines.find(
      (highline) => highline.id === focusedMarker,
    );

    if (highlineToFocus) {
      setHighlightedMarker(highlineToFocus);
      setClusteredMarkers([highlineToFocus]);

      const ne: [number, number] = [
        Math.max(highlineToFocus.anchor_a_long, highlineToFocus.anchor_b_long),
        Math.max(highlineToFocus.anchor_a_lat, highlineToFocus.anchor_b_lat),
      ];
      const sw: [number, number] = [
        Math.min(highlineToFocus.anchor_a_long, highlineToFocus.anchor_b_long),
        Math.min(highlineToFocus.anchor_a_lat, highlineToFocus.anchor_b_lat),
      ];

      cameraRef.current?.fitBounds(ne, sw, [100, 50, 300, 50], 1000);

      hasFocusedMarkerBeenHandled.current = true;
      router.setParams({ focusedMarker: undefined });
    }
  }, [focusedMarker, highlines, isLoading, isMapReady, router]);

  useEffect(() => {
    if (!highlightedMarker) return;

    const ne: [number, number] = [
      Math.max(
        highlightedMarker.anchor_a_long,
        highlightedMarker.anchor_b_long,
      ),
      Math.max(highlightedMarker.anchor_a_lat, highlightedMarker.anchor_b_lat),
    ];
    const sw: [number, number] = [
      Math.min(
        highlightedMarker.anchor_a_long,
        highlightedMarker.anchor_b_long,
      ),
      Math.min(highlightedMarker.anchor_a_lat, highlightedMarker.anchor_b_lat),
    ];
    cameraRef.current?.fitBounds(ne, sw, [50, 50, 200, 250], 1000);
  }, [highlightedMarker, focusedMarker]);

  useEffect(() => {
    return () => {
      throttledCameraUpdate.cancel();
    };
  }, [throttledCameraUpdate]);

  if (isMapStyleLoading) {
    return <View style={{ flex: 1 }} />;
  }

  return (
    <View style={{ flex: 1 }}>
      <Mapbox.MapView
        ref={mapRef}
        style={{ flex: 1 }}
        styleURL={mapStyle}
        scaleBarEnabled={false}
        onCameraChanged={handleCameraChanged}
        onMapIdle={handleCameraChanged}
        onDidFinishLoadingMap={() => {
          setIsMapReady(true);
          if (!focusedMarker) {
            goToMyLocation();
          }
        }}
        onPress={handleMapPress}
      >
        <Mapbox.Camera
          ref={cameraRef}
          zoomLevel={DEFAULT_ZOOM}
          maxZoomLevel={20}
          centerCoordinate={[DEFAULT_LONGITUDE, DEFAULT_LATITUDE]}
        />
        <Mapbox.UserLocation showsUserHeadingIndicator />

        <ChooselifeTrails />

        <Markers
          cameraRef={cameraRef}
          highlines={highlinesWithLocation}
          updateMarkers={handleMarkerUpdate}
        />
      </Mapbox.MapView>

      <WeatherCrosshair />

      <MapControls
        isOnMyLocation={isOnMyLocation}
        goToMyLocation={goToMyLocation}
        mapType={mapType}
        setMapType={setMapType}
      />

      <Activity mode={isSheetAvailable ? 'visible' : 'hidden'}>
        <ListingsBottomSheet isVisible={isSheetAvailable} />
      </Activity>

      {isMapCardVisible ? (
        <MapCardList
          highlines={clusteredMarkers}
          focusedMarker={highlightedMarker}
          changeFocusedMarker={handleChangeFocusedMarker}
          dark={mapType === 'satellite'}
        />
      ) : null}
    </View>
  );
}
