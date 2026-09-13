import MapboxGL from '@rnmapbox/maps';
import { useQueryClient } from '@tanstack/react-query';
import { useMapStore } from '~/store/map-store';
import type { Feature, FeatureCollection, LineString, Point } from 'geojson';
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
  withSequence,
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

/** A highline whose two anchors are both known, ready to draw. */
type HighlineDetail = {
  highline: Highline;
  distance: number;
  midpoint: [number, number];
  anchorA: [number, number];
  anchorB: [number, number];
  isHighlighted: boolean;
};

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

const lineStatusColor: Record<RigStatuses, string> = {
  planned: '#ffd54f',
  rigged: '#22C55E',
  unrigged: '#f44336',
};

/**
 * Last zoom at which highlines are grouped into clusters. Supercluster keeps a
 * tree per level up to this one and the raw points at `MAX_CLUSTER_ZOOM + 1`,
 * so querying past it hands back every point individually.
 */
const MAX_CLUSTER_ZOOM = 15;

/**
 * From here on nothing is clustered: every highline in view draws its own
 * anchors and line, which is what makes a spot readable once you are close
 * enough to care about the individual lines.
 */
const UNCLUSTERED_ZOOM = MAX_CLUSTER_ZOOM + 1;

type LineProperties = {
  highID: string;
  color: string;
  status: RigStatuses;
  highlighted: boolean;
};

type AnchorProperties = {
  highID: string;
  color: string;
  end: 'a' | 'b';
  highlighted: boolean;
};

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
    // Sequenced rather than re-assigned from the completion callback: writing to
    // the same shared value inside its own callback cancels the in-flight spring,
    // which fires the callback again, which writes again - unbounded recursion on
    // the UI thread ("Maximum call stack size exceeded") that takes the whole map
    // down with it.
    animation.value = withSequence(withSpring(1), withSpring(0));

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

const MarkersComponent: React.FC<{
  cameraRef: React.RefObject<MapboxGL.Camera | null>;
  highlines: Highline[] | null;
  updateMarkers: (highlines: Highline[], focused: Highline) => void;
}> = ({ cameraRef, highlines, updateMarkers }) => {
  const { profile } = useAuth();
  const queryClient = useQueryClient();

  // Subscribed separately so a pure zoom change does not invalidate anything
  // keyed on the viewport, and vice versa. The store hands back the same array
  // reference whenever the underlying values did not move.
  const cameraBounds = useMapStore((state) => state.camera.bounds);
  const cameraZoom = useMapStore((state) => state.camera.zoom);
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
      maxZoom: MAX_CLUSTER_ZOOM,
    }).load(points);
  }, [points]);

  // Supercluster buckets on whole zoom levels, so flooring before the memo
  // means a fractional zoom inside the same level costs nothing.
  const clusterZoom = Math.floor(cameraZoom);

  const clusters = useMemo(() => {
    return supercluster.getClusters(cameraBounds, clusterZoom);
  }, [supercluster, cameraBounds, clusterZoom]);

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

  /**
   * Everything that needs both anchors - the line, its length label and the B
   * marker - is resolved once here, so the render pass does no trigonometry
   * and the line collection below is built from the same validated list.
   */
  const detailFeatures = useMemo<HighlineDetail[]>(() => {
    const details: HighlineDetail[] = [];

    detailHighlines.forEach((highline) => {
      const { anchor_a_lat, anchor_a_long, anchor_b_lat, anchor_b_long } =
        highline;

      if (
        typeof anchor_a_lat !== 'number' ||
        typeof anchor_a_long !== 'number' ||
        typeof anchor_b_lat !== 'number' ||
        typeof anchor_b_long !== 'number'
      ) {
        return;
      }

      const distance = haversineDistance(
        anchor_a_lat,
        anchor_a_long,
        anchor_b_lat,
        anchor_b_long,
      );

      if (distance < 5) return;

      details.push({
        highline,
        distance,
        midpoint: calculateMidpoint(
          anchor_a_lat,
          anchor_a_long,
          anchor_b_lat,
          anchor_b_long,
        ),
        anchorA: [anchor_a_long, anchor_a_lat],
        anchorB: [anchor_b_long, anchor_b_lat],
        isHighlighted: highlightedMarker?.id === highline.id,
      });
    });

    return details;
  }, [detailHighlines, highlightedMarker?.id]);

  const lineFeatures = useMemo<FeatureCollection<LineString, LineProperties>>(
    () => ({
      type: 'FeatureCollection',
      features: detailFeatures.map(
        ({ highline, anchorA, anchorB, isHighlighted }) => ({
          type: 'Feature',
          id: highline.id,
          properties: {
            highID: highline.id,
            color: highline.status
              ? lineStatusColor[highline.status as RigStatuses]
              : '#000000',
            status: highline.status as RigStatuses,
            highlighted: isHighlighted,
          },
          geometry: {
            type: 'LineString',
            coordinates: [anchorA, anchorB],
          },
        }),
      ),
    }),
    [detailFeatures],
  );

  /**
   * Every anchor on screen in one collection: the A ends that survived
   * clustering plus the B ends of whatever is drawn in detail. The old code
   * mounted two React views per highline for this; a single source means the
   * count no longer costs anything.
   */
  const anchorFeatures = useMemo<FeatureCollection<Point, AnchorProperties>>(
    () => {
      const features: Feature<Point, AnchorProperties>[] = [];

      const push = (
        highID: string,
        end: 'a' | 'b',
        coordinates: [number, number],
        status: RigStatuses | null,
        highlighted: boolean,
      ) => {
        features.push({
          type: 'Feature',
          id: `${highID}-${end}`,
          properties: {
            highID,
            color: status ? lineStatusColor[status] : '#000000',
            end,
            highlighted,
          },
          geometry: { type: 'Point', coordinates },
        });
      };

      clusters.forEach((point) => {
        if (isClusterFeature<PointProperties, Supercluster.AnyProps>(point)) {
          return;
        }

        const [longitude, latitude] = point.geometry.coordinates;

        if (typeof longitude !== 'number' || typeof latitude !== 'number') {
          return;
        }

        // While a highline is focused only its own Anchor A stays on the map.
        if (
          highlightedMarker &&
          highlightedMarker.id !== point.properties.highID
        ) {
          return;
        }

        push(
          point.properties.highID,
          'a',
          [longitude, latitude],
          point.properties.status,
          highlightedMarker?.id === point.properties.highID,
        );
      });

      if (forcedHighlightedAnchorA) {
        push(
          forcedHighlightedAnchorA.id,
          'a',
          [
            forcedHighlightedAnchorA.anchor_a_long,
            forcedHighlightedAnchorA.anchor_a_lat,
          ],
          forcedHighlightedAnchorA.status as RigStatuses,
          true,
        );
      }

      detailFeatures.forEach(({ highline, anchorB, isHighlighted }) => {
        push(
          highline.id,
          'b',
          anchorB,
          highline.status as RigStatuses,
          isHighlighted,
        );
      });

      return { type: 'FeatureCollection', features };
    },
    [clusters, detailFeatures, forcedHighlightedAnchorA, highlightedMarker],
  );

  const focusedDetail = useMemo(
    () => detailFeatures.find((detail) => detail.isHighlighted) ?? null,
    [detailFeatures],
  );

  const handleClusterPress = useCallback(
    (cluster_id: number): void => {
      const expansionZoom =
        supercluster.getClusterExpansionZoom(cluster_id) || 20;

      // Never fly past the point where the cluster is gone anyway.
      const clampedZoom = Math.min(expansionZoom, UNCLUSTERED_ZOOM);

      const cluster = clusters.find(
        (c) =>
          isClusterFeature<PointProperties, Supercluster.AnyProps>(c) &&
          c.properties.cluster_id === cluster_id,
      );

      if (!cluster) return;

      const [lng, lat] = cluster.geometry.coordinates;

      const zoomDifference = clampedZoom - cameraZoom;
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
      cameraZoom,
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

  /** Anchors and lines both open the same highline card the pins used to. */
  const handleFeaturePress = useCallback(
    (event: ShapeSourcePressEvent) => {
      const highID = event?.features?.[0]?.properties?.highID;

      if (highID) handleMarkerSelect(highID);
    },
    [handleMarkerSelect],
  );

  return (
    <>
      {/*
        The line is the object. Both anchors and every line live in two native
        sources, so what used to be three React views per highline - two pins
        and a length label, all fighting for the same few pixels around a
        shared anchor - is now map furniture that cannot pile up.
      */}
      {lineFeatures.features.length > 0 ? (
        <MapboxGL.ShapeSource
          id="highline-lines"
          shape={lineFeatures}
          hitbox={PRESS_HITBOX}
          onPress={handleFeaturePress}
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
          onPress={handleFeaturePress}
        >
          <MapboxGL.CircleLayer
            id="highline-anchors-circle"
            style={ANCHOR_LAYER_STYLE}
          />
        </MapboxGL.ShapeSource>
      ) : null}

      {/*
        Only the focused highline spends label space. Everything else about it
        is in the card, and one label on screen can never collide with another.
      */}
      {focusedDetail ? (
        <MapboxGL.MarkerView
          id={`length-${focusedDetail.highline.id}`}
          coordinate={focusedDetail.midpoint}
          anchor={{ x: 0.5, y: 0.5 }}
          {...NEVER_COLLIDE}
        >
          <LengthLabel distance={focusedDetail.distance} />
        </MapboxGL.MarkerView>
      ) : null}

      {/* Clusters stay React views - there are only ever a handful on screen. */}
      {clusters.map((point) => {
        if (!isClusterFeature<PointProperties, Supercluster.AnyProps>(point)) {
          return null;
        }

        if (highlightedMarker) return null;

        const [longitude, latitude] = point.geometry.coordinates;

        if (typeof longitude !== 'number' || typeof latitude !== 'number') {
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
      })}
    </>
  );
};

export const Markers = React.memo(MarkersComponent);

Markers.displayName = 'Markers';
