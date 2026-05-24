import Mapbox from '@rnmapbox/maps';
import { useMapStore } from '~/store/map-store';
import { useLocalSearchParams, useRouter } from 'expo-router';
import throttle from 'lodash.throttle';
import React, { Activity, useCallback, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';
import { useShallow } from 'zustand/react/shallow';

import { useHighline, type Highline } from '~/hooks/use-highline';
import { useMapStyle } from '~/hooks/use-map-style';
import { useMountEffect } from '~/hooks/use-mount-effect';
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

import { getHighlineBounds, getMyLocation } from '../utils';

function FocusedMarkerController({
  highline,
  focusHighline,
  clearFocusedMarker,
  setClusteredMarkers,
  setHighlightedMarker,
}: {
  highline: Highline;
  focusHighline: (
    highline: Highline,
    padding: [number, number, number, number],
  ) => void;
  clearFocusedMarker: () => void;
  setClusteredMarkers: (highlines: Highline[]) => void;
  setHighlightedMarker: (highline: Highline | null) => void;
}) {
  useMountEffect(() => {
    setHighlightedMarker(highline);
    setClusteredMarkers([highline]);
    focusHighline(highline, [100, 50, 300, 50]);
    clearFocusedMarker();
  });

  return null;
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

  const { focusedMarker } = useLocalSearchParams<{ focusedMarker?: string }>();
  const router = useRouter();

  const isMapCardVisible = clusteredMarkers.length > 0;
  const isSheetAvailable = !isMapCardVisible && !focusedMarker;

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

  const focusedHighline = useMemo(() => {
    if (!focusedMarker || isLoading || highlines.length === 0) {
      return null;
    }

    return highlines.find((highline) => highline.id === focusedMarker) ?? null;
  }, [focusedMarker, highlines, isLoading]);

  const focusHighline = useCallback(
    (highline: Highline, padding: [number, number, number, number]) => {
      const { ne, sw } = getHighlineBounds(highline);
      cameraRef.current?.fitBounds(ne, sw, padding, 1000);
    },
    [],
  );

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

  const throttledCameraUpdate = useMemo(
    () =>
      throttle(
        (state: Mapbox.MapState) => {
          setIsOnMyLocation(false);
          setCamera(state);
        },
        500,
        { leading: true, trailing: true },
      ),
    [setCamera],
  );

  useMountEffect(() => {
    return () => {
      throttledCameraUpdate.cancel();
    };
  });

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
      focusHighline(focused, [50, 50, 200, 250]);
    },
    [focusHighline, setClusteredMarkers, setHighlightedMarker],
  );

  const handleChangeFocusedMarker = useCallback(
    (high: Highline) => {
      setHighlightedMarker(high);
      focusHighline(high, [50, 50, 200, 250]);
    },
    [focusHighline, setHighlightedMarker],
  );

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
        <Mapbox.LocationPuck puckBearingEnabled puckBearing="heading" />

        <ChooselifeTrails />

        <Markers
          cameraRef={cameraRef}
          highlines={highlinesWithLocation}
          updateMarkers={handleMarkerUpdate}
        />
      </Mapbox.MapView>

      {isMapReady && focusedHighline ? (
        <FocusedMarkerController
          key={focusedHighline.id}
          highline={focusedHighline}
          focusHighline={focusHighline}
          clearFocusedMarker={() =>
            router.setParams({ focusedMarker: undefined })
          }
          setClusteredMarkers={setClusteredMarkers}
          setHighlightedMarker={setHighlightedMarker}
        />
      ) : null}

      <WeatherCrosshair />

      <MapControls
        isOnMyLocation={isOnMyLocation}
        goToMyLocation={goToMyLocation}
        mapType={mapType}
        setMapType={setMapType}
      />

      <Activity mode={isSheetAvailable ? 'visible' : 'hidden'}>
        <ListingsBottomSheet />
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
