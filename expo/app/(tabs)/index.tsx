import Mapbox from '@rnmapbox/maps';
import * as Location from 'expo-location';
import { useLocalSearchParams } from 'expo-router';
import { useAtom, useSetAtom } from 'jotai';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { View } from 'react-native';

import {
  useHighline,
  type Highline,
  type HighlineCategory,
} from '~/hooks/use-highline';
import { calculateZoomLevel } from '~/utils';

import ListingsBottomSheet from '~/components/map/bottom-sheet';
import MapControls from '~/components/map/controls';
import ExploreHeader from '~/components/map/explore-header';
import { MapCardList } from '~/components/map/map-card';
import { Markers } from '~/components/map/markers';
import {
  cameraStateAtom,
  clusterMarkersAtom,
  DEFAULT_LATITUDE,
  DEFAULT_LONGITUDE,
  DEFAULT_ZOOM,
  highlightedMarkerAtom,
} from '~/components/map/utils';

const getMapStyle = (mapType: string) => {
  return mapType === 'satellite'
    ? Mapbox.StyleURL.SatelliteStreet
    : Mapbox.StyleURL.Outdoors;
};

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
  // Refs
  const mapRef = useRef<Mapbox.MapView>(null);
  const cameraRef = useRef<Mapbox.Camera>(null);

  // state
  const [isOnMyLocation, setIsOnMyLocation] = useState(false);
  const [mapType, setMapType] = useState<'satellite' | 'standard'>('satellite');
  const [searchTerm, setSearchTerm] = useState('');

  // atoms
  const setCamera = useSetAtom(cameraStateAtom);
  const [highlightedMarker, setHighlightedMarker] = useAtom(
    highlightedMarkerAtom,
  );
  const [clusterMarkers, setClusterMarkers] = useAtom(clusterMarkersAtom);

  // URL params
  const { focusedMarker } = useLocalSearchParams<{ focusedMarker?: string }>();

  // Hooks
  const { highlines, setSelectedCategory, isLoading } = useHighline({
    searchTerm,
  });

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

  const handleMapIdle = useCallback(
    (state: Mapbox.MapState) => {
      setIsOnMyLocation(false);

      const { sw, ne } = state.properties.bounds;
      setCamera({
        center: state.properties.center,
        zoom: state.properties.zoom,
        bounds: [sw[0], sw[1], ne[0], ne[1]],
      });
    },
    [setCamera],
  );

  const handleMapPress = useCallback(() => {
    if (highlightedMarker) {
      setHighlightedMarker(null);
      setClusterMarkers([]);
    }
  }, [highlightedMarker, setHighlightedMarker, setClusterMarkers]);

  const handleMarkerUpdate = useCallback(
    (highlines: Highline[], focused: Highline) => {
      setClusterMarkers(highlines);
      setHighlightedMarker(focused);
    },
    [setClusterMarkers, setHighlightedMarker],
  );

  const handleChangeFocusedMarker = useCallback(
    (high: Highline) => {
      setHighlightedMarker(high);
    },
    [setHighlightedMarker],
  );

  useEffect(() => {
    if (!focusedMarker || !highlines) {
      setHighlightedMarker(null);
      setClusterMarkers([]);
      return;
    }

    const highlineToFocus = highlines.find(
      (highline) => highline.id === focusedMarker,
    );

    if (highlineToFocus) {
      setHighlightedMarker(highlineToFocus);
      setClusterMarkers([highlineToFocus]);

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

  return (
    <View style={{ flex: 1 }}>
      <ExploreHeader
        onSearchChange={handleSearchChange}
        onCategoryChange={handleCategoryChange}
      />

      <Mapbox.MapView
        ref={mapRef}
        style={{ flex: 1 }}
        styleURL={getMapStyle(mapType)}
        scaleBarEnabled={false}
        onMapIdle={handleMapIdle}
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
          centerCoordinate={[DEFAULT_LONGITUDE, DEFAULT_LATITUDE]}
        />
        <Mapbox.UserLocation showsUserHeadingIndicator />

        <Markers
          cameraRef={cameraRef}
          highlines={highlinesWithLocation}
          highlightedMarker={highlightedMarker}
          updateMarkers={handleMarkerUpdate}
        />
      </Mapbox.MapView>

      <MapControls
        isOnMyLocation={isOnMyLocation}
        goToMyLocation={goToMyLocation}
        mapType={mapType}
        setMapType={setMapType}
      />

      {clusterMarkers.length > 0 ? (
        <MapCardList
          highlines={clusterMarkers}
          focusedMarker={highlightedMarker}
          changeFocusedMarker={handleChangeFocusedMarker}
        />
      ) : null}

      <ListingsBottomSheet
        highlines={highlines}
        hasFocusedMarker={!!focusedMarker}
        isLoading={isLoading}
      />
    </View>
  );
}
