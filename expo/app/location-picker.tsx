import Mapbox from '@rnmapbox/maps';
import { useMapStore } from '~/store/map-store';
import { useLocalSearchParams, useRouter } from 'expo-router';
import type { Position } from 'geojson';
import { MapPinIcon } from 'lucide-react-native';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import Animated, { FadeInUp, FadeOutUp } from 'react-native-reanimated';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { highlineKeyFactory } from '~/hooks/use-highline';
import { supabase } from '~/lib/supabase';
import {
  DEFAULT_LATITUDE,
  DEFAULT_LONGITUDE,
  DEFAULT_ZOOM,
} from '~/utils/constants';

import { PickerControls } from '~/components/map/picker-button';
import { haversineDistance, positionToPostGISPoint } from '~/components/map/utils';
import { Icon } from '~/components/ui/icon';
import { Text } from '~/components/ui/text';

const LocationPickerScreen: React.FC = () => {
  const mapRef = useRef<Mapbox.MapView>(null);
  const router = useRouter();
  const queryClient = useQueryClient();

  // Check if we're editing an existing highline
  const { editHighlineId } = useLocalSearchParams<{ editHighlineId?: string }>();

  // State to store the two picked locations
  const [anchorA, setAnchorA] = useState<Position | null>(null);
  const [anchorB, setAnchorB] = useState<Position | null>(null);
  const setCamera = useMapStore((state) => state.setCamera);

  // Mutation to update existing highline location
  const updateLocationMutation = useMutation({
    mutationFn: async ({ anchorA, anchorB }: { anchorA: Position; anchorB: Position }) => {
      if (!editHighlineId) throw new Error('No highline ID provided');

      const length = haversineDistance(anchorA[1], anchorA[0], anchorB[1], anchorB[0]);

      const { error } = await supabase
        .from('highline')
        .update({
          anchor_a: positionToPostGISPoint(anchorA),
          anchor_b: positionToPostGISPoint(anchorB),
          length: Math.round(length),
        })
        .eq('id', editHighlineId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: highlineKeyFactory.list() });
      queryClient.invalidateQueries({ queryKey: highlineKeyFactory.detail(editHighlineId!) });
      router.back();
    },
  });

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

    // If editing existing highline, update its location
    if (editHighlineId) {
      updateLocationMutation.mutate({ anchorA, anchorB });
      return;
    }

    // Otherwise, go to register form for new highline
    router.push({
      pathname: '/register-highline',
      params: {
        anchorA: JSON.stringify(anchorA),
        anchorB: JSON.stringify(anchorB),
      },
    });
  }, [anchorA, anchorB, router, editHighlineId, updateLocationMutation]);

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
      {updateLocationMutation.isPending && (
        <View className="absolute inset-0 z-50 bg-black/50 items-center justify-center">
          <ActivityIndicator size="large" color="white" />
        </View>
      )}

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
        <Mapbox.UserLocation showsUserHeadingIndicator />

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
      <Icon as={MapPinIcon} className="size-9 text-black fill-red-500" />
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
      <Icon as={MapPinIcon} className="size-9 text-black fill-red-500" />
    </Mapbox.PointAnnotation>
  );
};

const DistanceLabel: React.FC<{
  anchorA: Position | null;
  anchorB: Position | null;
}> = ({ anchorA, anchorB }) => {
  const camera = useMapStore((state) => state.camera);

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
  const camera = useMapStore((state) => state.camera);

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
