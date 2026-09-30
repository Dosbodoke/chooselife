import Mapbox from '@rnmapbox/maps';
import type { AnchorPosition } from '~/features/highline-registration/state/model';
import { isCameraOnLocation } from '~/store/camera-state';
import { useMapStore, type LocationPickerRequest } from '~/store/map-store';
import { useLocalSearchParams, useRouter } from 'expo-router';
import type { Position } from 'geojson';
import throttle from 'lodash.throttle';
import { ChevronLeftIcon } from 'lucide-react-native';
import React, { Activity, useCallback, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
import { HighlinePickerMapLayers } from '~/components/map/highline-picker-map-layers';
import { HighlinePickerOverlay } from '~/components/map/highline-picker-overlay';
import { MapCardList } from '~/components/map/map-card';
import { Markers } from '~/components/map/markers';
import { ChooselifeTrails } from '~/components/map/trail-shape';
import WeatherCrosshair from '~/components/map/weather-crosshair';
import { Icon } from '~/components/ui/icon';

import { getHighlineBounds, getMyLocation } from '../utils';

const FILL_STYLE = { flex: 1 } as const;

/**
 * The camera is uncontrolled: every intentional move goes through
 * `cameraRef.current.setCamera(...)`. Passing `centerCoordinate`/`zoomLevel` as
 * props instead would put it in controlled mode, where rnmapbox rebuilds its
 * native camera stop from the prop identity on every render and can fight an
 * in-flight animation.
 */
const DEFAULT_CAMERA_SETTINGS: Mapbox.CameraStop = {
  centerCoordinate: [DEFAULT_LONGITUDE, DEFAULT_LATITUDE],
  zoomLevel: DEFAULT_ZOOM,
};

const MY_LOCATION_ANIMATION_DURATION = 1000;

function useThrottledCameraUpdate(callback: (state: Mapbox.MapState) => void) {
  const throttled = useMemo(
    () => throttle(callback, 500, { leading: true, trailing: true }),
    [callback],
  );

  useMountEffect(() => {
    return () => {
      throttled.cancel();
    };
  });

  return throttled;
}

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

function EditPickerCameraController({
  request,
  cameraRef,
}: {
  request: Extract<LocationPickerRequest, { kind: 'edit' }>;
  cameraRef: React.RefObject<Mapbox.Camera | null>;
}) {
  useMountEffect(() => {
    const { anchorA, anchorB } = request;
    if (!anchorA || !anchorB) return;

    const northEast: Position = [
      Math.max(anchorA[0], anchorB[0]),
      Math.max(anchorA[1], anchorB[1]),
    ];
    const southWest: Position = [
      Math.min(anchorA[0], anchorB[0]),
      Math.min(anchorA[1], anchorB[1]),
    ];

    cameraRef.current?.fitBounds(northEast, southWest, [100, 80, 260, 80], 700);
  });

  return null;
}

function NewPickerCameraController({
  request,
  cameraRef,
}: {
  request: Extract<LocationPickerRequest, { kind: 'new' }>;
  cameraRef: React.RefObject<Mapbox.Camera | null>;
}) {
  useMountEffect(() => {
    if (!request.center) return;

    cameraRef.current?.setCamera({
      centerCoordinate: request.center,
      zoomLevel: request.zoom,
      animationDuration: 0,
    });
  });

  return null;
}

export default function ExploreMap() {
  useOfflineRegion();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  const mapRef = useRef<Mapbox.MapView>(null);
  const cameraRef = useRef<Mapbox.Camera>(null);
  const latestCameraCenterRef = useRef<AnchorPosition>(
    useMapStore.getState().camera.center as AnchorPosition,
  );

  const [isOnMyLocation, setIsOnMyLocation] = useState(false);
  const [isMapReady, setIsMapReady] = useState(false);

  // Where `goToMyLocation` last aimed. The locate control latches on the camera
  // reaching it rather than on a timer, so the throttled camera handler cannot
  // clear the flag mid-flight and anything that later moves the camera away
  // releases it on its own.
  const myLocationTargetRef = useRef<Position | null>(null);
  const searchQuery = useMapStore((state) => state.searchQuery);
  const activeCategory = useMapStore((state) => state.activeCategory);
  const locationPickerRequest = useMapStore(
    (state) => state.locationPickerRequest,
  );
  const locationPickerSession = useMapStore(
    (state) => state.locationPickerSession,
  );
  const clearLocationPickerRequest = useMapStore(
    (state) => state.clearLocationPickerRequest,
  );
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
  const isPickerActive = locationPickerRequest !== null;
  const isSheetAvailable =
    !isPickerActive && !isMapCardVisible && !focusedMarker;

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
    myLocationTargetRef.current = [region.longitude, region.latitude];

    cameraRef.current?.setCamera({
      centerCoordinate: [region.longitude, region.latitude],
      zoomLevel: 16,
      animationDuration: MY_LOCATION_ANIMATION_DURATION,
      animationMode: 'flyTo',
    });
    setIsOnMyLocation(true);
  }, [setUserLocation]);

  const cameraCallback = useCallback(
    (state: Mapbox.MapState) => {
      setIsOnMyLocation(
        isCameraOnLocation(
          state.properties.center,
          myLocationTargetRef.current,
        ),
      );

      setCamera(state);
    },
    [setCamera],
  );

  const throttledCameraUpdate = useThrottledCameraUpdate(cameraCallback);

  const handleCameraChanged = useCallback(
    (state: Mapbox.MapState) => {
      latestCameraCenterRef.current = [
        state.properties.center[0],
        state.properties.center[1],
      ];
      throttledCameraUpdate(state);
    },
    [throttledCameraUpdate],
  );

  const getCurrentCameraCenter = useCallback(
    () => latestCameraCenterRef.current,
    [],
  );

  const handleDidFinishLoadingMap = useCallback(() => {
    setIsMapReady(true);
    if (locationPickerRequest?.kind === 'edit') {
      const { anchorA, anchorB } = locationPickerRequest;
      if (anchorA && anchorB) {
        const northEast: Position = [
          Math.max(anchorA[0], anchorB[0]),
          Math.max(anchorA[1], anchorB[1]),
        ];
        const southWest: Position = [
          Math.min(anchorA[0], anchorB[0]),
          Math.min(anchorA[1], anchorB[1]),
        ];
        cameraRef.current?.fitBounds(
          northEast,
          southWest,
          [100, 80, 260, 80],
          700,
        );
        return;
      }
    }
    if (locationPickerRequest?.kind === 'new' && locationPickerRequest.center) {
      cameraRef.current?.setCamera({
        centerCoordinate: locationPickerRequest.center,
        zoomLevel: locationPickerRequest.zoom,
        animationDuration: 0,
      });
      return;
    }
    if (
      !focusedMarker &&
      !(locationPickerRequest?.kind === 'new' && locationPickerRequest.center)
    ) {
      goToMyLocation();
    }
  }, [focusedMarker, goToMyLocation, locationPickerRequest]);

  const handleClearFocusedMarker = useCallback(() => {
    router.setParams({ focusedMarker: undefined });
  }, [router]);

  const handleMapPress = useCallback(() => {
    if (isPickerActive) return;
    if (highlightedMarker) {
      setHighlightedMarker(null);
      setClusteredMarkers([]);
    }
  }, [
    highlightedMarker,
    isPickerActive,
    setClusteredMarkers,
    setHighlightedMarker,
  ]);

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
    return <View style={FILL_STYLE} />;
  }

  return (
    <View style={FILL_STYLE}>
      <Mapbox.MapView
        ref={mapRef}
        style={FILL_STYLE}
        styleURL={mapStyle}
        scaleBarEnabled={false}
        onCameraChanged={handleCameraChanged}
        onMapIdle={handleCameraChanged}
        onDidFinishLoadingMap={handleDidFinishLoadingMap}
        onPress={isPickerActive ? undefined : handleMapPress}
      >
        <Mapbox.Camera
          ref={cameraRef}
          maxZoomLevel={20}
          defaultSettings={DEFAULT_CAMERA_SETTINGS}
        />
        <ChooselifeTrails />

        <HighlinePickerMapLayers />

        <Markers
          cameraRef={cameraRef}
          highlines={highlinesWithLocation}
          updateMarkers={handleMarkerUpdate}
          interactive={!isPickerActive}
          visible={
            !isPickerActive ||
            locationPickerSession?.existingHighlinesVisible !== false
          }
        />

        {/*
          Declared last so the puck draws above the markers. Markers opt out of
          puck collision (`allowOverlapWithPuck`), so this only affects stacking
          - it can never hide a pin or a cluster.
        */}
        <Mapbox.LocationPuck puckBearingEnabled puckBearing="heading" />
      </Mapbox.MapView>

      {isMapReady && focusedHighline ? (
        <FocusedMarkerController
          key={focusedHighline.id}
          highline={focusedHighline}
          focusHighline={focusHighline}
          clearFocusedMarker={handleClearFocusedMarker}
          setClusteredMarkers={setClusteredMarkers}
          setHighlightedMarker={setHighlightedMarker}
        />
      ) : null}

      {locationPickerRequest?.kind === 'edit' ? (
        <EditPickerCameraController
          key={locationPickerRequest.requestId}
          request={locationPickerRequest}
          cameraRef={cameraRef}
        />
      ) : null}

      {locationPickerRequest?.kind === 'new' && locationPickerRequest.center ? (
        <NewPickerCameraController
          key={locationPickerRequest.requestId}
          request={locationPickerRequest}
          cameraRef={cameraRef}
        />
      ) : null}

      {!isPickerActive ? <WeatherCrosshair /> : null}

      {!isPickerActive && highlightedMarker ? (
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={t('components.onboard.goBack')}
          testID="map-clear-selection"
          onPress={handleMapPress}
          style={{
            position: 'absolute',
            top: insets.top + 16,
            left: insets.left + 8,
            width: 48,
            height: 48,
            borderRadius: 8,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'white',
          }}
        >
          <Icon as={ChevronLeftIcon} size={24} color="black" />
        </TouchableOpacity>
      ) : null}

      <MapControls
        isOnMyLocation={isOnMyLocation}
        goToMyLocation={goToMyLocation}
        mapType={mapType}
        setMapType={setMapType}
      />

      <Activity mode={isSheetAvailable ? 'visible' : 'hidden'}>
        <ListingsBottomSheet />
      </Activity>

      {!isPickerActive && isMapCardVisible ? (
        <MapCardList
          highlines={clusteredMarkers}
          focusedMarker={highlightedMarker}
          changeFocusedMarker={handleChangeFocusedMarker}
          dark={mapType === 'satellite'}
        />
      ) : null}

      {locationPickerRequest ? (
        <HighlinePickerOverlay
          key={locationPickerRequest.requestId}
          request={locationPickerRequest}
          getCurrentCenter={getCurrentCameraCenter}
          onBack={() => {
            clearLocationPickerRequest();
            if (locationPickerRequest.kind === 'edit' && router.canGoBack()) {
              router.back();
            }
          }}
        />
      ) : null}
    </View>
  );
}
