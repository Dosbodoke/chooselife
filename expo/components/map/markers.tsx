import MapboxGL from '@rnmapbox/maps';
import { useQueryClient } from '@tanstack/react-query';
import { useMapStore } from '~/store/map-store';
import React, { useCallback, useMemo } from 'react';
import { Pressable, View } from 'react-native';
import SuperclusterClass, {
  isClusterFeature,
  type Supercluster,
} from 'react-native-clusterer';
import Animated, {
  interpolate,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import { useAuth } from '~/context/auth';
import { highlineKeyFactory, type Highline } from '~/hooks/use-highline';
import { RigStatuses } from '~/hooks/use-rig-setup';
import { MIN_CLUSTER_SIZE } from '~/utils/constants';

import { Text } from '~/components/ui/text';

import { calculateMidpoint, haversineDistance } from './utils';

interface PointProperties {
  cluster: boolean;
  category: string;
  highID: string;
  status: RigStatuses;
}

const statusColor: Record<RigStatuses, string> = {
  planned: 'bg-amber-300',
  rigged: 'bg-green-500',
  unrigged: 'bg-red-500',
};

const lineStatusColor: Record<RigStatuses, string> = {
  planned: '#ffd54f',
  rigged: '#22C55E',
  unrigged: '#f44336',
};

const AnchorMarker: React.FC<{
  label: 'A' | 'B';
  isHighlighted: boolean;
  status?: RigStatuses;
}> = ({ label, isHighlighted, status }) => {
  const bgColor = status ? statusColor[status] : 'bg-blue-500';

  return (
    <View
      style={{ opacity: isHighlighted ? 1 : 0.85 }}
      className={`${bgColor} size-6 rounded-full flex items-center justify-center border-2 border-white shadow-lg`}
    >
      <Text className="text-white font-bold text-xs">{label}</Text>
    </View>
  );
};

const LengthLabel: React.FC<{ distance: number; isHighlighted: boolean }> = ({
  distance,
  isHighlighted,
}) => (
  <View
    pointerEvents="none"
    style={{ opacity: isHighlighted ? 1 : 0.7 }}
    className="bg-black/60 rounded-md px-2 py-1"
  >
    <Text className="text-white font-semibold text-xs">
      {`${Math.round(distance)}m`}
    </Text>
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

    onPress();
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

  const points = useMemo<Supercluster.PointFeature<PointProperties>[]>(() => {
    if (!highlines) return [];

    return highlines.map((h) => ({
      type: 'Feature',
      properties: {
        cluster: false,
        category: 'highline',
        highID: h.id,
        status: h.status as RigStatuses,
      },
      geometry: {
        type: 'Point',
        coordinates: [h.anchor_a_long, h.anchor_a_lat],
      },
    }));
  }, [highlines]);

  const supercluster = useMemo(() => {
    return new SuperclusterClass<PointProperties>({
      radius: 40,
      maxZoom: 25,
    }).load(points);
  }, [points]);

  const clusters = useMemo(() => {
    return supercluster.getClusters(camera.bounds, Math.floor(camera.zoom));
  }, [supercluster, camera.bounds, camera.zoom]);

  /**
   * These are the highlines whose Anchor A is actually visible as an individual
   * marker at the current zoom/bounds.
   *
   * If a highline is inside a cluster, it will NOT be in this set.
   * That means its distance label, line and Anchor B should not render.
   */
  const visibleAnchorAHighlineIds = useMemo(() => {
    const ids = new Set<string>();

    clusters.forEach((point) => {
      if (!isClusterFeature<PointProperties, Supercluster.AnyProps>(point)) {
        ids.add(point.properties.highID);
      }
    });

    return ids;
  }, [clusters]);

  /**
   * Distance labels, lines and Anchor B markers are low-priority details.
   * They should only render when:
   *
   * 1. The highline's Anchor A is visible individually; or
   * 2. The highline is currently highlighted.
   */
  const detailHighlines = useMemo(() => {
    if (highlightedMarker) {
      const highlightedFromList = highlines?.find(
        (highline) => highline.id === highlightedMarker.id,
      );

      return highlightedFromList ? [highlightedFromList] : [highlightedMarker];
    }

    if (!highlines) return [];

    return highlines.filter((highline) =>
      visibleAnchorAHighlineIds.has(highline.id),
    );
  }, [highlines, highlightedMarker, visibleAnchorAHighlineIds]);

  /**
   * When a highlighted highline is still inside a cluster during the camera
   * transition, clusters are hidden and the normal Anchor A loop won't render it.
   * This fallback guarantees the selected highline still has its Anchor A.
   */
  const forcedHighlightedAnchorA = useMemo(() => {
    if (!highlightedMarker) return null;

    if (visibleAnchorAHighlineIds.has(highlightedMarker.id)) {
      return null;
    }

    return highlightedMarker;
  }, [highlightedMarker, visibleAnchorAHighlineIds]);

  const handleClusterPress = useCallback(
    (cluster_id: number): void => {
      const expansionZoom =
        supercluster.getClusterExpansionZoom(cluster_id) || 20;

      const clampedZoom = Math.min(expansionZoom, 17);

      const cluster = clusters.find(
        (c) =>
          isClusterFeature<PointProperties, Supercluster.AnyProps>(c) &&
          c.properties.cluster_id === cluster_id,
      );

      if (!cluster) return;

      const [lng, lat] = cluster.geometry.coordinates;

      const zoomDifference = clampedZoom - camera.zoom;
      const shouldHighlightCards = zoomDifference < 0.5;

      if (shouldHighlightCards) {
        const leaves = supercluster.getLeaves(cluster_id, Infinity);

        const highlinesData =
          queryClient.getQueryData<Highline[]>(
            highlineKeyFactory.list(profile?.id),
          ) || [];

        const highlinesFromLeaves: Highline[] = [];

        leaves.forEach((leaf) => {
          const highline = highlinesData.find(
            (high) => high.id === leaf.properties.highID,
          );

          if (highline) {
            highlinesFromLeaves.push(highline);
          }
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
      {/* 
        Low-priority details first.

        Distance labels should never win visually over clusters or Anchor A.
        They are only rendered for visible individual highlines or highlighted one.
      */}
      {detailHighlines.map((highline) => {
        if (
          typeof highline.anchor_a_lat !== 'number' ||
          typeof highline.anchor_a_long !== 'number' ||
          typeof highline.anchor_b_lat !== 'number' ||
          typeof highline.anchor_b_long !== 'number'
        ) {
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
                  lineColor: highline.status
                    ? lineStatusColor[highline.status as RigStatuses]
                    : '#000000',
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

            <MapboxGL.MarkerView
              id={`marker-B-${highline.id}`}
              coordinate={[highline.anchor_b_long, highline.anchor_b_lat]}
            >
              <Pressable onPress={() => handleMarkerSelect(highline.id)}>
                <AnchorMarker
                  label="B"
                  isHighlighted={isHighlighted}
                  status={highline.status as RigStatuses}
                />
              </Pressable>
            </MapboxGL.MarkerView>
          </React.Fragment>
        );
      })}

      {/* 
  High-priority markers second.

  When a highline is highlighted, only its own Anchor A should render.
  All other Anchor A markers must be hidden.
*/}
      {clusters.map((point) => {
        const [longitude, latitude] = point.geometry.coordinates;

        if (typeof longitude !== 'number' || typeof latitude !== 'number') {
          return null;
        }

        if (isClusterFeature<PointProperties, Supercluster.AnyProps>(point)) {
          if (highlightedMarker) {
            return null;
          }

          const size = Math.max(
            (point.properties.point_count * 40) / (points.length || 1),
            MIN_CLUSTER_SIZE,
          );

          return (
            <ClusteredMarker
              key={`cluster-${point.properties.cluster_id}`}
              size={size}
              coordinate={[longitude, latitude]}
              pointCount={point.properties.point_count}
              onPress={() => handleClusterPress(point.properties.cluster_id)}
            />
          );
        }

        if (
          highlightedMarker &&
          highlightedMarker.id !== point.properties.highID
        ) {
          return null;
        }

        const isHighlighted = highlightedMarker?.id === point.properties.highID;

        return (
          <MapboxGL.MarkerView
            key={`marker-A-${point.properties.highID}`}
            id={`marker-A-${point.properties.highID}`}
            coordinate={[longitude, latitude]}
          >
            <Pressable
              onPress={() => handleMarkerSelect(point.properties.highID)}
            >
              <AnchorMarker
                label="A"
                isHighlighted={isHighlighted}
                status={point.properties.status}
              />
            </Pressable>
          </MapboxGL.MarkerView>
        );
      })}

      {forcedHighlightedAnchorA ? (
        <MapboxGL.MarkerView
          key={`marker-A-highlighted-${forcedHighlightedAnchorA.id}`}
          id={`marker-A-highlighted-${forcedHighlightedAnchorA.id}`}
          coordinate={[
            forcedHighlightedAnchorA.anchor_a_long,
            forcedHighlightedAnchorA.anchor_a_lat,
          ]}
        >
          <Pressable
            onPress={() => handleMarkerSelect(forcedHighlightedAnchorA.id)}
          >
            <AnchorMarker
              label="A"
              isHighlighted
              status={forcedHighlightedAnchorA.status as RigStatuses}
            />
          </Pressable>
        </MapboxGL.MarkerView>
      ) : null}
    </>
  );
};
