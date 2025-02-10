import Mapbox from '@rnmapbox/maps';
import * as Location from 'expo-location';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useSetAtom } from 'jotai';
import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';

import { useHighlineList } from '~/hooks/use-highline-list';
import { calculateZoomLevel } from '~/utils';

import ListingsBottomSheet from '~/components/map/bottom-sheet';
import MapControls from '~/components/map/controls';
import ExploreHeader from '~/components/map/explore-header';
import { MapCardList } from '~/components/map/map-card';
import { Markers } from '~/components/map/markers';
import {
  cameraStateAtom,
  DEFAULT_LATITUDE,
  DEFAULT_LONGITUDE,
  DEFAULT_ZOOM,
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
  const mapRef = useRef<Mapbox.MapView>(null);
  const cameraRef = useRef<Mapbox.Camera>(null);

  const [isOnMyLocation, setIsOnMyLocation] = useState(false);
  const [mapType, setMapType] = useState<'satellite' | 'standard'>('satellite');
  const setCamera = useSetAtom(cameraStateAtom);
  const [searchTerm, setSearchTerm] = useState('');
  const { focusedMarker } = useLocalSearchParams<{ focusedMarker?: string }>();

  const {
    highlines,
    highlightedMarker,
    clusterMarkers,
    setHighlightedMarker,
    setClusterMarkers,
    setSelectedCategory,
    isLoading,
  } = useHighlineList({ searchTerm });

  async function goToMyLocation() {
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
  }

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
        [0, 50, 200, 250, 1000],
      );
    }
  }, [focusedMarker, highlines]);

  return (
    <View style={{ flex: 1 }}>
      <Stack.Screen
        options={{
          header: () => (
            <ExploreHeader
              onSearchChange={setSearchTerm}
              onCategoryChange={(category) => setSelectedCategory(category)}
            />
          ),
        }}
      />

      <Mapbox.MapView
        ref={mapRef}
        style={{ flex: 1 }}
        styleURL={getMapStyle(mapType)}
        scaleBarEnabled={false}
        onMapIdle={(state) => {
          setIsOnMyLocation(false);

          const { sw, ne } = state.properties.bounds;
          setCamera({
            center: state.properties.center,
            zoom: state.properties.zoom,
            bounds: [sw[0], sw[1], ne[0], ne[1]],
          });
        }}
        onDidFinishRenderingMap={() => {
          if (!focusedMarker) {
            goToMyLocation();
          }
        }}
        onPress={() => {
          if (highlightedMarker) {
            setHighlightedMarker(null);
            setClusterMarkers([]);
          }
        }}
      >
        <Mapbox.Camera
          ref={cameraRef}
          zoomLevel={DEFAULT_ZOOM}
          centerCoordinate={[DEFAULT_LONGITUDE, DEFAULT_LATITUDE]}
        />

        <Mapbox.UserLocation showsUserHeadingIndicator />

        <Markers
          cameraRef={cameraRef}
          highlines={highlines}
          highlightedMarker={highlightedMarker}
          updateMarkers={(highlines, focused) => {
            setClusterMarkers(highlines);
            setHighlightedMarker(focused);
          }}
        />
      </Mapbox.MapView>

      <MapControls
        isOnMyLocation={isOnMyLocation}
        goToMyLocation={goToMyLocation}
        mapType={mapType}
        setMapType={setMapType}
      />

      {clusterMarkers.length > 0 && (
        <MapCardList
          highlines={clusterMarkers}
          focusedMarker={highlightedMarker}
          changeFocusedMarker={(high) => setHighlightedMarker(high)}
        />
      )}

      <ListingsBottomSheet
        highlines={highlines}
        hasFocusedMarker={!!focusedMarker}
        isLoading={isLoading}
      />
    </View>
  );
}
