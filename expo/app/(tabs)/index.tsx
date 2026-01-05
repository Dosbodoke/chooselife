import Mapbox from '@rnmapbox/maps';
import { useMapStore } from '~/store/map-store';
import * as Location from 'expo-location';
import { useLocalSearchParams } from 'expo-router';
import throttle from 'lodash.throttle';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { View } from 'react-native';
import { useShallow } from 'zustand/react/shallow';

import {
  useHighline,
  type Highline,
  type HighlineCategory,
} from '~/hooks/use-highline';
import { useMapStyle } from '~/hooks/use-map-style';
import { useOfflineRegion } from '~/hooks/use-offline-region';
import { calculateZoomLevel } from '~/utils';
import {
  DEFAULT_LATITUDE,
  DEFAULT_LONGITUDE,
  DEFAULT_ZOOM,
} from '~/utils/constants';

import ListingsBottomSheet from '~/components/map/bottom-sheet';
import MapControls from '~/components/map/controls';
import ExploreHeader from '~/components/map/explore-header';
import { MapCardList } from '~/components/map/map-card';
import { Markers } from '~/components/map/markers';
import { ChooselifeTrails } from '~/components/map/trail-shape';
import { WeatherInfoCard } from '~/components/map/weather-info-card';

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
      // Try to fetch the current location.
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

export default function Screen() {
  useOfflineRegion();

  const mapRef = useRef<Mapbox.MapView>(null);
  const cameraRef = useRef<Mapbox.Camera>(null);

  const [isOnMyLocation, setIsOnMyLocation] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [weatherEnabled, setWeatherEnabled] = useState(false);
  const setCamera = useMapStore((state) => state.setCamera);
  const [highlightedMarker, setHighlightedMarker] = useMapStore(
    useShallow((state) => [
      state.highlightedMarker,
      state.setHighlightedMarker,
    ]),
  );
  const [clusteredMarkers, setClusteredMarkers] = useMapStore(
    useShallow((state) => [state.clusteredMarkers, state.setClusteredMarkers]),
  );

  // URL params
  const { focusedMarker } = useLocalSearchParams<{ focusedMarker?: string }>();

  // Hooks
  const { highlines, setSelectedCategory, isLoading } = useHighline({
    searchTerm,
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

    const newZoom = calculateZoomLevel(region.latitudeDelta);
    cameraRef.current?.setCamera({
      centerCoordinate: [region.longitude, region.latitude],
      zoomLevel: newZoom,
      animationDuration: 1000,
      animationMode: 'flyTo',
    });
    setIsOnMyLocation(true);
  }, []);

  const handleSearchChange = useCallback(
    (text: string) => setSearchTerm(text),
    [],
  );

  const handleCategoryChange = useCallback(
    (category: HighlineCategory | null) => setSelectedCategory(category),
    [],
  );

  // Throttled camera change handler (updates at most once every 500ms)
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
    [setCamera, isOnMyLocation, setIsOnMyLocation],
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
  }, [highlightedMarker, setHighlightedMarker, setClusteredMarkers]);

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

  const handleToggleWeather = useCallback(() => {
    setWeatherEnabled((prev) => !prev);
  }, []);

  useEffect(() => {
    if (!focusedMarker || !highlines) {
      setHighlightedMarker(null);
      setClusteredMarkers([]);
      return;
    }

    const highlineToFocus = highlines.find(
      (highline) => highline.id === focusedMarker,
    );

    if (highlineToFocus) {
      setHighlightedMarker(highlineToFocus);
      setClusteredMarkers([highlineToFocus]);

      // Calculate the southwest and northeast bounds from the two anchors.
      const minLat = Math.min(
        highlineToFocus.anchor_a_lat,
        highlineToFocus.anchor_b_lat,
      );
      const maxLat = Math.max(
        highlineToFocus.anchor_a_lat,
        highlineToFocus.anchor_b_lat,
      );
      const minLng = Math.min(
        highlineToFocus.anchor_a_long,
        highlineToFocus.anchor_b_long,
      );
      const maxLng = Math.max(
        highlineToFocus.anchor_a_long,
        highlineToFocus.anchor_b_long,
      );

      cameraRef.current?.fitBounds(
        [maxLng, maxLat], // northeast [lng, lat]
        [minLng, minLat], // southwest [lng, lat]
        [0, 50, 200, 250, 1000], // padding
      );
    }
  }, [focusedMarker, highlines]);

  // Adjust camera when a marker is highlighted.
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
  }, [highlightedMarker, cameraRef]);

  // Clean up the throttle function on unmount
  useEffect(() => {
    return () => {
      throttledCameraUpdate.cancel();
    };
  }, [throttledCameraUpdate]);

  // Don't render the map until we've loaded the map style preference
  if (isMapStyleLoading) {
    return <View style={{ flex: 1 }} />; // You could add a loading spinner here
  }

  return (
    <View style={{ flex: 1 }}>
      <ExploreHeader
        onSearchChange={handleSearchChange}
        onCategoryChange={handleCategoryChange}
      />

      <Mapbox.MapView
        ref={mapRef}
        style={{ flex: 1 }}
        styleURL={mapStyle}
        scaleBarEnabled={false}
        onCameraChanged={handleCameraChanged}
        onMapIdle={handleCameraChanged}
        onDidFinishLoadingMap={() => {
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

      <MapControls
        isOnMyLocation={isOnMyLocation}
        goToMyLocation={goToMyLocation}
        mapType={mapType}
        setMapType={setMapType}
        weatherEnabled={weatherEnabled}
        onToggleWeather={handleToggleWeather}
      />

      {clusteredMarkers.length > 0 ? (
        <MapCardList
          highlines={clusteredMarkers}
          focusedMarker={highlightedMarker}
          changeFocusedMarker={handleChangeFocusedMarker}
        />
      ) : null}

      <ListingsBottomSheet
        highlines={highlines}
        hasFocusedMarker={!!focusedMarker}
        isLoading={isLoading}
      />

      {weatherEnabled && (
        <WeatherInfoCard
          latitude={highlightedMarker?.anchor_a_lat ?? DEFAULT_LATITUDE}
          longitude={highlightedMarker?.anchor_a_long ?? DEFAULT_LONGITUDE}
          onClose={handleToggleWeather}
          locationName={highlightedMarker?.name}
        />
      )}
    </View>
  );
}
