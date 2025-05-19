import Mapbox from '@rnmapbox/maps';
import { useCameraStateStore } from '~/store/map-store';
import { useLocalSearchParams, useRouter } from 'expo-router';
import type { Position } from 'geojson';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';
import Animated, { FadeInUp, FadeOutUp } from 'react-native-reanimated';

import { LucideIcon } from '~/lib/icons/lucide-icon';
import {
  DEFAULT_LATITUDE,
  DEFAULT_LONGITUDE,
  DEFAULT_ZOOM,
} from '~/utils/constants';

import { PickerControls } from '~/components/map/picker-button';
import { haversineDistance } from '~/components/map/utils';
import { Text } from '~/components/ui/text';

const LocationPickerScreen: React.FC = () => {
  const mapRef = useRef<Mapbox.MapView>(null);
  const router = useRouter();

  // State to store the two picked locations
  const [anchorA, setAnchorA] = useState<Position | null>(null);
  const [anchorB, setAnchorB] = useState<Position | null>(null);
  const setCamera = useCameraStateStore((state) => state.setCamera);

  const handlePickLocation = useCallback(async () => {
    const center = await mapRef.current?.getCenter();
    if (!center) return;
    if (!anchorA) {
      setAnchorA(center);
      return;
    }
    if (!anchorB) {
      setAnchorB(center);
      return;
    }

    // Screen with form to register the highline
    router.push({
      pathname: '/register-highline',
      params: {
        anchorA: JSON.stringify(anchorA),
        anchorB: JSON.stringify(anchorB),
      },
    });
  }, [anchorA, anchorB, router]);

  // Undo the last location selection (or navigate back if none selected)
  const handleUndoPickLocation = useCallback(() => {
    if (anchorB) {
      setAnchorB(null);
      return;
    }
    if (anchorA) {
      setAnchorA(null);
      return;
    }
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace('/(tabs)');
  }, [anchorA, anchorB, router]);

  // Determine the current stage of the picker.
  const stage = useMemo(() => {
    if (!anchorA) return 'initial';
    if (!anchorB) return 'partial';
    return 'final';
  }, [anchorA, anchorB]);

  return (
    <View className="relative flex-1">
      <Mapbox.MapView
        style={{ width: '100%', height: '100%' }}
        scaleBarEnabled={false}
        styleURL={Mapbox.StyleURL.SatelliteStreet}
        ref={mapRef}
        onCameraChanged={(state) => {
          // Only update if the user has already placed the first anchor.
          if (anchorA) {
            setCamera(state);
          }
        }}
      >
        <Camera />
        <Mapbox.UserLocation visible={true} />

        {anchorA && (
          <AnchorPin id="anchorA" anchor={anchorA} setAnchor={setAnchorA} />
        )}
        {anchorB && (
          <AnchorPin id="anchorB" anchor={anchorB} setAnchor={setAnchorB} />
        )}

        {anchorA ? (
          <LineSourceLayer anchorA={anchorA} anchorB={anchorB} />
        ) : null}
      </Mapbox.MapView>

      {(!anchorA || !anchorB) && (
        <FakeMarker anchorA={anchorA} anchorB={anchorB} />
      )}

      <PickerControls
        onPick={handlePickLocation}
        onUndo={handleUndoPickLocation}
        stage={stage}
      />
    </View>
  );
};

const Camera = () => {
  const { lat, lng, zoom } = useLocalSearchParams<{
    lat?: string;
    lng?: string;
    zoom?: string;
  }>();

  return (
    <Mapbox.Camera
      zoomLevel={zoom ? +zoom : DEFAULT_ZOOM}
      centerCoordinate={
        lat && lng ? [+lng, +lat] : [DEFAULT_LONGITUDE, DEFAULT_LATITUDE]
      }
      animationMode="none"
      animationDuration={0}
    />
  );
};

const FakeMarker: React.FC<{
  anchorA: Position | null;
  anchorB: Position | null;
}> = ({ anchorA, anchorB }) => {
  return (
    <View
      pointerEvents="none"
      className="absolute bottom-1/2 flex w-full items-center justify-center"
    >
      <DistanceLabel anchorA={anchorA} anchorB={anchorB} />
      <LucideIcon name="MapPin" className="size-9 text-black fill-red-500" />
    </View>
  );
};

const AnchorPin: React.FC<{
  anchor: Position;
  setAnchor: React.Dispatch<React.SetStateAction<Position | null>>;
  id: 'anchorA' | 'anchorB';
}> = ({ anchor, setAnchor, id }) => {
  return (
    <Mapbox.PointAnnotation
      id={id}
      coordinate={anchor}
      draggable
      onDragEnd={(e) => {
        setAnchor(e.geometry.coordinates);
      }}
      anchor={{ y: 1, x: 0.5 }}
    >
      <LucideIcon name="MapPin" className="size-9 text-black fill-red-500" />
    </Mapbox.PointAnnotation>
  );
};

const DistanceLabel: React.FC<{
  anchorA: Position | null;
  anchorB: Position | null;
}> = ({ anchorA, anchorB }) => {
  const camera = useCameraStateStore((state) => state);

  const distance = useMemo(() => {
    if (!anchorA) return;
    return haversineDistance(
      anchorA[1],
      anchorA[0],
      anchorB ? anchorB[1] : camera.center[1],
      anchorB ? anchorB[0] : camera.center[0],
    );
  }, [anchorA, anchorB, camera.center]);

  if (!anchorA) return;

  return (
    <Animated.View
      className="mb-1 rounded-2xl bg-slate-950 px-2 py-1"
      entering={FadeInUp}
      exiting={FadeOutUp}
    >
      <Text className="text-white">{distance?.toFixed()}m</Text>
    </Animated.View>
  );
};

const LineSourceLayer: React.FC<{
  anchorA: Position;
  anchorB: Position | null;
}> = React.memo(({ anchorA, anchorB }) => {
  const camera = useCameraStateStore((state) => state);

  let lineCoordinates: number[][] | null = null;
  if (anchorA && anchorB) {
    lineCoordinates = [anchorA, anchorB];
  } else if (anchorA && !anchorB) {
    lineCoordinates = [camera.center, anchorA];
  }

  if (!lineCoordinates) return null;

  return (
    <Mapbox.ShapeSource
      id="lineSource"
      shape={{
        type: 'Feature',
        geometry: {
          type: 'LineString',
          coordinates: lineCoordinates,
        },
        properties: {},
      }}
    >
      <Mapbox.LineLayer
        id="lineLayer"
        style={{
          lineWidth: 3,
          lineColor: '#FFF',
          lineDasharray: [2, 2],
        }}
      />
    </Mapbox.ShapeSource>
  );
});

export default LocationPickerScreen;
