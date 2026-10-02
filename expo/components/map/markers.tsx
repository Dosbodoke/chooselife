import MapboxGL from '@rnmapbox/maps';
import { useQueryClient } from '@tanstack/react-query';
import { useMapStore } from '~/store/map-store';
import React, { useCallback } from 'react';
import { Pressable, View } from 'react-native';
import { isClusterFeature, type Supercluster } from 'react-native-clusterer';
import Animated, {
  interpolate,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
} from 'react-native-reanimated';

import { useAuth } from '~/context/auth';
import { highlineKeyFactory, type Highline } from '~/hooks/use-highline';
import { MIN_CLUSTER_SIZE } from '~/utils/constants';

import { Text } from '~/components/ui/text';

import {
  UNCLUSTERED_ZOOM,
  useMarkerData,
  type HighlineDetail,
  type MarkerClusterList,
  type MarkerData,
  type PointProperties,
} from './marker-data';

/**
 * `MarkerView` defaults both of these to false, which makes Mapbox drop any
 * marker that collides with a neighbour or with the LocationPuck - so the pins
 * closest to the user, the ones that matter most, were the first to disappear.
 * Every marker here is deliberately exempt from collision culling.
 */
const NEVER_COLLIDE = {
  allowOverlap: true,
  allowOverlapWithPuck: true,
} as const;

type LineStyle = React.ComponentProps<typeof MapboxGL.LineLayer>['style'];
type CircleStyle = React.ComponentProps<typeof MapboxGL.CircleLayer>['style'];

/** Shape of the tap payload rnmapbox hands a ShapeSource's `onPress`. */
type ShapeSourcePressEvent = {
  features?: { properties?: { highID?: string } | null }[];
};

/**
 * A dark casing under every coloured line. Satellite imagery has no consistent
 * luminance, so a thin saturated stroke on its own disappears over pale rock
 * and bright water - the casing is what lets one line width work everywhere.
 */
const LINE_CASING_STYLE: LineStyle = {
  lineColor: '#0A0A0A',
  lineOpacity: 0.55,
  lineWidth: ['case', ['get', 'highlighted'], 8, 5],
  lineCap: 'round',
};

/**
 * Data-driven so every line shares one layer: `color` and `highlighted` are
 * read off each feature instead of baking a layer per highline.
 */
const LINE_STROKE_STYLE: LineStyle = {
  lineColor: ['get', 'color'],
  lineWidth: ['case', ['get', 'highlighted'], 5, 3],
  lineCap: 'round',
};

/**
 * Status is carried by dash as well as colour. Red and green is the one pair
 * deuteranopes cannot separate - roughly one man in twelve - so rigged reads
 * solid and unrigged reads broken even when the hue does not land.
 *
 * `lineDasharray` takes no data expression, which is why this is a second
 * layer over the same source rather than another `case`.
 */
const LINE_DASHED_STYLE: LineStyle = {
  ...LINE_STROKE_STYLE,
  lineDasharray: [2.2, 1.4],
};

const SOLID_LINE_FILTER = ['!=', ['get', 'status'], 'unrigged'];
const DASHED_LINE_FILTER = ['==', ['get', 'status'], 'unrigged'];

/**
 * Anchors are one native CircleLayer rather than two `MarkerView`s per
 * highline: one layer draws every anchor on screen at any count, it is
 * z-ordered against the location puck like real map furniture, and there are
 * no React views to keep in sync with the camera. A is filled with the status
 * colour, B is hollow - the shape says which end you are looking at, so the
 * pins no longer need to carry a letter each.
 */
const ANCHOR_LAYER_STYLE: CircleStyle = {
  circleRadius: [
    'case',
    ['all', ['==', ['get', 'end'], 'a'], ['get', 'highlighted']],
    7.5,
    ['==', ['get', 'end'], 'a'],
    6,
    ['get', 'highlighted'],
    6,
    4.5,
  ],
  circleColor: [
    'case',
    ['==', ['get', 'end'], 'a'],
    ['get', 'color'],
    '#FFFFFF',
  ],
  circleStrokeColor: [
    'case',
    ['==', ['get', 'end'], 'a'],
    '#FFFFFF',
    ['get', 'color'],
  ],
  circleStrokeWidth: 2,
  circlePitchAlignment: 'map',
};

const PRESS_HITBOX = { width: 36, height: 36 } as const;

const LengthLabel: React.FC<{ distance: number }> = ({ distance }) => (
  <View pointerEvents="none" className="bg-black/70 rounded-md px-2 py-1">
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
      animation.get(),
      [0, 1],
      ['#FFFFFF', '#93C5FD'],
    );

    const scale = interpolate(animation.get(), [0, 1], [1, 0.9]);

    return {
      backgroundColor,
      transform: [{ scale }],
    };
  });

  const handlePress = () => {
    // Sequenced rather than re-assigned from the completion callback: writing to
    // the same shared value inside its own callback cancels the in-flight spring,
    // which fires the callback again, which writes again - unbounded recursion on
    // the UI thread ("Maximum call stack size exceeded") that takes the whole map
    // down with it.
    animation.set(withSequence(withSpring(1), withSpring(0)));

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
    <MapboxGL.MarkerView coordinate={coordinate} {...NEVER_COLLIDE}>
      <AnimatedCluster pointCount={pointCount} size={size} onPress={onPress} />
    </MapboxGL.MarkerView>
  ),
);

type MarkerShapeLayersProps = Pick<
  MarkerData,
  'lineFeatures' | 'anchorFeatures'
> & {
  onPress: (event: ShapeSourcePressEvent) => void;
};

/** Native line and anchor sources, isolated from viewport derivation. */
const MarkerShapeLayers = React.memo(
  ({ lineFeatures, anchorFeatures, onPress }: MarkerShapeLayersProps) => (
    <>
      {lineFeatures.features.length > 0 ? (
        <MapboxGL.ShapeSource
          id="highline-lines"
          shape={lineFeatures}
          hitbox={PRESS_HITBOX}
          onPress={onPress}
        >
          <MapboxGL.LineLayer
            id="highline-lines-casing"
            style={LINE_CASING_STYLE}
          />
          <MapboxGL.LineLayer
            id="highline-lines-solid"
            filter={SOLID_LINE_FILTER as never}
            style={LINE_STROKE_STYLE}
          />
          <MapboxGL.LineLayer
            id="highline-lines-dashed"
            filter={DASHED_LINE_FILTER as never}
            style={LINE_DASHED_STYLE}
          />
        </MapboxGL.ShapeSource>
      ) : null}

      {anchorFeatures.features.length > 0 ? (
        <MapboxGL.ShapeSource
          id="highline-anchors"
          shape={anchorFeatures}
          hitbox={PRESS_HITBOX}
          onPress={onPress}
        >
          <MapboxGL.CircleLayer
            id="highline-anchors-circle"
            style={ANCHOR_LAYER_STYLE}
          />
        </MapboxGL.ShapeSource>
      ) : null}
    </>
  ),
);

MarkerShapeLayers.displayName = 'MarkerShapeLayers';

const FocusedLengthMarker = React.memo(
  ({ detail }: { detail: HighlineDetail | null }) => {
    if (!detail) return null;

    return (
      <MapboxGL.MarkerView
        id={`length-${detail.highline.id}`}
        coordinate={detail.midpoint}
        anchor={{ x: 0.5, y: 0.5 }}
        {...NEVER_COLLIDE}
      >
        <LengthLabel distance={detail.distance} />
      </MapboxGL.MarkerView>
    );
  },
);

FocusedLengthMarker.displayName = 'FocusedLengthMarker';

type ClusterMarkersProps = {
  clusters: MarkerClusterList;
  pointCount: number;
  hasHighlightedMarker: boolean;
  onPress: (clusterId: number) => void;
};

/** Renders the small, bounded set of React cluster views over native layers. */
const ClusterMarkers = React.memo(
  ({
    clusters,
    pointCount,
    hasHighlightedMarker,
    onPress,
  }: ClusterMarkersProps) => (
    <>
      {clusters.map((point) => {
        if (!isClusterFeature<PointProperties, Supercluster.AnyProps>(point)) {
          return null;
        }

        if (hasHighlightedMarker) return null;

        const [longitude, latitude] = point.geometry.coordinates;

        if (typeof longitude !== 'number' || typeof latitude !== 'number') {
          return null;
        }

        const size = Math.max(
          (point.properties.point_count * 40) / (pointCount || 1),
          MIN_CLUSTER_SIZE,
        );

        return (
          <ClusteredMarker
            key={`cluster-${point.properties.cluster_id}`}
            size={size}
            coordinate={[longitude, latitude]}
            pointCount={point.properties.point_count}
            onPress={() => onPress(point.properties.cluster_id)}
          />
        );
      })}
    </>
  ),
);

ClusterMarkers.displayName = 'ClusterMarkers';

type MarkerInteractionParams = {
  cameraRef: React.RefObject<MapboxGL.Camera | null>;
  profileId: string | undefined;
  supercluster: MarkerData['supercluster'];
  clusters: MarkerClusterList;
  cameraZoom: number;
  updateMarkers: (highlines: Highline[], focused: Highline) => void;
};

/** Keeps query lookup and camera/card actions together with stable callbacks. */
const useMarkerInteractions = ({
  cameraRef,
  profileId,
  supercluster,
  clusters,
  cameraZoom,
  updateMarkers,
}: MarkerInteractionParams) => {
  const queryClient = useQueryClient();

  const handleClusterPress = useCallback(
    (cluster_id: number): void => {
      const expansionZoom =
        supercluster.getClusterExpansionZoom(cluster_id) || 20;

      // Never fly past the point where the cluster is gone anyway.
      const clampedZoom = Math.min(expansionZoom, UNCLUSTERED_ZOOM);

      const cluster = clusters.find(
        (candidate) =>
          isClusterFeature<PointProperties, Supercluster.AnyProps>(candidate) &&
          candidate.properties.cluster_id === cluster_id,
      );

      if (!cluster) return;

      const [lng, lat] = cluster.geometry.coordinates;

      const zoomDifference = clampedZoom - cameraZoom;
      const shouldHighlightCards = zoomDifference < 0.5;

      if (shouldHighlightCards) {
        const leaves = supercluster.getLeaves(cluster_id, Infinity);

        const highlinesData =
          queryClient.getQueryData<Highline[]>(
            highlineKeyFactory.list(profileId),
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
      cameraZoom,
      cameraRef,
      updateMarkers,
      clusters,
      profileId,
    ],
  );

  const handleMarkerSelect = useCallback(
    (highID: string) => {
      const highline = (
        queryClient.getQueryData<Highline[]>(
          highlineKeyFactory.list(profileId),
        ) || []
      ).find((high) => high.id === highID);

      if (highline) {
        updateMarkers([highline], highline);
      }
    },
    [queryClient, updateMarkers, profileId],
  );

  /** Anchors and lines both open the same highline card the pins used to. */
  const handleFeaturePress = useCallback(
    (event: ShapeSourcePressEvent) => {
      const highID = event?.features?.[0]?.properties?.highID;

      if (highID) handleMarkerSelect(highID);
    },
    [handleMarkerSelect],
  );

  return { handleClusterPress, handleFeaturePress };
};

const MarkersComponent: React.FC<{
  cameraRef: React.RefObject<MapboxGL.Camera | null>;
  highlines: Highline[] | null;
  updateMarkers: (highlines: Highline[], focused: Highline) => void;
}> = ({ cameraRef, highlines, updateMarkers }) => {
  const { profile } = useAuth();

  // Keep bounds and zoom as separate subscriptions: each change invalidates
  // only the derivation that actually depends on it.
  const cameraBounds = useMapStore((state) => state.camera.bounds);
  const cameraZoom = useMapStore((state) => state.camera.zoom);
  const highlightedMarker = useMapStore((state) => state.highlightedMarker);

  const markerData = useMarkerData({
    highlines,
    cameraBounds,
    cameraZoom,
    highlightedMarker,
  });
  const { handleClusterPress, handleFeaturePress } = useMarkerInteractions({
    cameraRef,
    profileId: profile?.id,
    supercluster: markerData.supercluster,
    clusters: markerData.clusters,
    cameraZoom,
    updateMarkers,
  });

  return (
    <>
      <MarkerShapeLayers
        lineFeatures={markerData.lineFeatures}
        anchorFeatures={markerData.anchorFeatures}
        onPress={handleFeaturePress}
      />
      <FocusedLengthMarker detail={markerData.focusedDetail} />
      <ClusterMarkers
        clusters={markerData.clusters}
        pointCount={markerData.points.length}
        hasHighlightedMarker={Boolean(highlightedMarker)}
        onPress={handleClusterPress}
      />
    </>
  );
};

export const Markers = React.memo(MarkersComponent);

Markers.displayName = 'Markers';
