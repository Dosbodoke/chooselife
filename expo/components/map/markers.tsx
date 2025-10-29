import MapboxGL from '@rnmapbox/maps';
import { useQueryClient } from '@tanstack/react-query';
import { useMapStore } from '~/store/map-store';
import type { GeoJsonProperties } from 'geojson';
import React, { useCallback, useMemo } from 'react';
import { Pressable, View } from 'react-native';
import Animated, {
  interpolate,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { PointFeature } from 'supercluster';
import useSuperCluster from 'use-supercluster';

import { useAuth } from '~/context/auth';
import { highlineKeyFactory, type Highline } from '~/hooks/use-highline';
import { MIN_CLUSTER_SIZE } from '~/utils/constants';

import { Text } from '~/components/ui/text';

import { calculateMidpoint, haversineDistance } from './utils';

interface PointProperties {
  cluster: boolean;
  category: string;
  highID: string;
}

const AnchorMarker: React.FC<{ label: 'A' | 'B'; isHighlighted: boolean }> = ({
  label,
  isHighlighted,
}) => (
  <View
    style={{ opacity: isHighlighted ? 1 : 0.85 }}
    className="bg-blue-500 size-6 rounded-full flex items-center justify-center border-2 border-white shadow-lg"
  >
    <Text className="text-white font-bold text-xs">{label}</Text>
  </View>
);

const LengthLabel: React.FC<{ distance: number; isHighlighted: boolean }> = ({
  distance,
  isHighlighted,
}) => (
  <View
    style={{ opacity: isHighlighted ? 1 : 0.7 }}
    className="bg-black/60 rounded-md px-2 py-1"
  >
    <Text className="text-white font-semibold text-xs">{`${Math.round(
      distance,
    )}m`}</Text>
  </View>
);

const AnimatedCluster: React.FC<{
  pointCount: number;
  size: number;
  onPress: () => void;
}> = ({ pointCount, size, onPress }) => {
  const animation = useSharedValue(0);
  const animatedStyle = useAnimatedStyle(() => {
    const backgroundColor = interpolateColor(
      animation.value,
      [0, 1],
      ['#FFFFFF', '#93C5FD'],
    );
    const scale = interpolate(animation.value, [0, 1], [1, 0.9]);
    return {
      backgroundColor,
      transform: [{ scale }],
    };
  });

  const handlePress = () => {
    animation.value = withSpring(1, {}, () => {
      animation.value = withSpring(0);
    });
    if (onPress) onPress();
  };

  return (
    <Pressable onPress={handlePress}>
      <Animated.View
        style={[
          { width: size, height: size, borderRadius: size / 2 },
          animatedStyle,
        ]}
        className="flex items-center justify-center rounded-full bg-popover shadow-lg"
      >
        <Text className="text-center text-xl font-bold">{pointCount}</Text>
      </Animated.View>
    </Pressable>
  );
};

const ClusteredMarker = React.memo(
  ({
    coordinate,
    pointCount,
    size,
    onPress,
  }: {
    coordinate: [number, number];
    pointCount: number;
    size: number;
    onPress: () => void;
  }) => (
    <MapboxGL.MarkerView coordinate={coordinate}>
      <AnimatedCluster pointCount={pointCount} size={size} onPress={onPress} />
    </MapboxGL.MarkerView>
  ),
);

export const Markers: React.FC<{
  cameraRef: React.RefObject<MapboxGL.Camera | null>;
  highlines: Highline[] | null;
  updateMarkers: (highlines: Highline[], focused: Highline) => void;
}> = ({ cameraRef, highlines, updateMarkers }) => {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const camera = useMapStore((state) => state.camera);
  const highlightedMarker = useMapStore((state) => state.highlightedMarker);

  const points = useMemo<
    PointFeature<GeoJsonProperties & PointProperties>[]
  >(() => {
    if (!highlines) return [];
    return highlines.map((h) => ({
      type: 'Feature',
      properties: {
        cluster: false,
        category: 'highline',
        highID: h.id,
      },
      geometry: {
        type: 'Point',
        coordinates: [h.anchor_a_long, h.anchor_a_lat],
      },
    }));
  }, [highlines]);

  const { clusters, supercluster } = useSuperCluster({
    points,
    bounds: camera.bounds,
    zoom: camera.zoom,
    options: { radius: 40, maxZoom: 25 },
  });

  const handleClusterPress = useCallback(
    (cluster_id: number): void => {
      if (!supercluster) return;
      const expansionZoom =
        supercluster.getClusterExpansionZoom(cluster_id) || 20;
      const clampedZoom = Math.min(expansionZoom, 17);
      const cluster = clusters.find(
        (c) => c.properties.cluster && c.properties.cluster_id === cluster_id,
      );
      if (!cluster) return;
      const [lng, lat] = cluster.geometry.coordinates;

      const zoomDifference = clampedZoom - camera.zoom;
      const shouldHighlightCards = zoomDifference < 0.5;

      if (shouldHighlightCards) {
        const leaves = supercluster.getLeaves(cluster_id);
        const highlinesData =
          queryClient.getQueryData<Highline[]>(
            highlineKeyFactory.list(profile?.id),
          ) || [];
        const highlinesFromLeaves: Highline[] = [];
        leaves.forEach((l) => {
          const highline = highlinesData.find(
            (high) => high.id === l.properties.highID,
          );
          if (highline) highlinesFromLeaves.push(highline);
        });
        if (highlinesFromLeaves.length > 0) {
          updateMarkers(highlinesFromLeaves, highlinesFromLeaves[0]);
        }
        return;
      }

      cameraRef.current?.setCamera({
        centerCoordinate: [lng, lat],
        zoomLevel: clampedZoom,
        animationDuration: 300,
        animationMode: 'flyTo',
      });
    },
    [
      queryClient,
      supercluster,
      camera.zoom,
      cameraRef,
      updateMarkers,
      clusters,
      profile?.id,
    ],
  );

  const handleMarkerSelect = useCallback(
    (highID: string) => {
      const highline = (
        queryClient.getQueryData<Highline[]>(
          highlineKeyFactory.list(profile?.id),
        ) || []
      ).find((high) => high.id === highID);
      if (highline) {
        updateMarkers([highline], highline);
      }
    },
    [queryClient, updateMarkers, profile?.id],
  );

  return (
    <>
      {/* Loop 1: Render Anchor A's and Clusters */}
      {clusters.map((point) => {
        const { properties } = point;
        const [longitude, latitude] = point.geometry.coordinates;
        if (typeof longitude !== 'number' || typeof latitude !== 'number') {
          return null;
        }

        if (properties.cluster) {
          // Hide clusters when individual markers are selected
          if (highlightedMarker) {
            return null;
          }
          const size = Math.max(
            (properties.point_count * 40) / (points.length || 1),
            MIN_CLUSTER_SIZE,
          );
          return (
            <ClusteredMarker
              key={`cluster-${properties.cluster_id}`}
              size={size}
              coordinate={[longitude, latitude]}
              pointCount={properties.point_count}
              onPress={() => handleClusterPress(properties.cluster_id)}
            />
          );
        }

        const isHighlighted = highlightedMarker?.id === properties.highID;
        return (
          <MapboxGL.MarkerView
            key={`marker-A-${properties.highID}`}
            id={`marker-A-${properties.highID}`}
            coordinate={[longitude, latitude]}
          >
            <Pressable onPress={() => handleMarkerSelect(properties.highID)}>
              <AnchorMarker label="A" isHighlighted={isHighlighted} />
            </Pressable>
          </MapboxGL.MarkerView>
        );
      })}

      {/* Loop 2: Render Polylines, Anchor B's, and Length Labels */}
      {highlines?.map((highline) => {
        // Filter visibility when a marker/cluster is highlighted
        if (highlightedMarker && highlightedMarker.id !== highline.id) {
          return null;
        }

        const distance = haversineDistance(
          highline.anchor_a_lat,
          highline.anchor_a_long,
          highline.anchor_b_lat,
          highline.anchor_b_long,
        );

        if (distance < 5) return null;

        const isHighlighted = highlightedMarker?.id === highline.id;

        return (
          <React.Fragment key={`details-${highline.id}`}>
            <MapboxGL.MarkerView
              key={`marker-A-${highline.id}`}
              id={`marker-A-${highline.id}`}
              coordinate={[highline.anchor_a_long, highline.anchor_a_lat]}
            >
              <Pressable onPress={() => handleMarkerSelect(highline.id)}>
                <AnchorMarker label="A" isHighlighted={isHighlighted} />
              </Pressable>
            </MapboxGL.MarkerView>

            <MapboxGL.MarkerView
              id={`marker-B-${highline.id}`}
              coordinate={[highline.anchor_b_long, highline.anchor_b_lat]}
            >
              <Pressable onPress={() => handleMarkerSelect(highline.id)}>
                <AnchorMarker label="B" isHighlighted={isHighlighted} />
              </Pressable>
            </MapboxGL.MarkerView>

            <MapboxGL.ShapeSource
              id={`line-${highline.id}`}
              shape={{
                type: 'Feature',
                geometry: {
                  type: 'LineString',
                  coordinates: [
                    [highline.anchor_a_long, highline.anchor_a_lat],
                    [highline.anchor_b_long, highline.anchor_b_lat],
                  ],
                },
                properties: {},
              }}
            >
              <MapboxGL.LineLayer
                id={`line-layer-${highline.id}`}
                style={{
                  lineColor: isHighlighted ? '#3b82f6' : '#000000',
                  lineWidth: isHighlighted ? 3 : 1.5,
                  lineOpacity: isHighlighted ? 0.9 : 0.4,
                }}
              />
            </MapboxGL.ShapeSource>

            <MapboxGL.MarkerView
              id={`length-${highline.id}`}
              coordinate={calculateMidpoint(
                highline.anchor_a_lat,
                highline.anchor_a_long,
                highline.anchor_b_lat,
                highline.anchor_b_long,
              )}
              anchor={{ x: 0.5, y: 0.5 }}
            >
              <LengthLabel distance={distance} isHighlighted={isHighlighted} />
            </MapboxGL.MarkerView>
          </React.Fragment>
        );
      })}
    </>
  );
};
