import type {
  BBox,
  Feature,
  FeatureCollection,
  LineString,
  Point,
} from 'geojson';
import { useMemo } from 'react';
import SuperclusterClass, {
  isClusterFeature,
  type Supercluster,
} from 'react-native-clusterer';

import type { Highline } from '~/hooks/use-highline';
import { RigStatuses } from '~/hooks/use-rig-setup';

import { calculateMidpoint, haversineDistance } from './utils';

export interface PointProperties {
  cluster: boolean;
  category: string;
  highID: string;
  status: RigStatuses;
}

/** A highline whose two anchors are both known, ready to draw. */
export type HighlineDetail = {
  highline: Highline;
  distance: number;
  midpoint: [number, number];
  anchorA: [number, number];
  anchorB: [number, number];
  isHighlighted: boolean;
};

export type LineProperties = {
  highID: string;
  color: string;
  status: RigStatuses;
  highlighted: boolean;
};

export type AnchorProperties = {
  highID: string;
  color: string;
  end: 'a' | 'b';
  highlighted: boolean;
};

export const lineStatusColor: Record<RigStatuses, string> = {
  planned: '#ffd54f',
  rigged: '#22C55E',
  unrigged: '#f44336',
};

/** Last zoom level at which Supercluster groups highlines. */
const MAX_CLUSTER_ZOOM = 15;

/** At this level every highline has its own anchors and line. */
export const UNCLUSTERED_ZOOM = MAX_CLUSTER_ZOOM + 1;

export type MarkerCluster = ReturnType<
  SuperclusterClass<PointProperties>['getClusters']
>[number];
export type MarkerClusterList = MarkerCluster[];

export type MarkerData = {
  points: Supercluster.PointFeature<PointProperties>[];
  supercluster: SuperclusterClass<PointProperties>;
  clusters: MarkerClusterList;
  lineFeatures: FeatureCollection<LineString, LineProperties>;
  anchorFeatures: FeatureCollection<Point, AnchorProperties>;
  focusedDetail: HighlineDetail | null;
};

/**
 * Derives all viewport-dependent marker data without synchronizing derived
 * state. The rendering component can therefore focus on native layers and
 * interaction callbacks.
 */
export const useMarkerData = ({
  highlines,
  cameraBounds,
  cameraZoom,
  highlightedMarker,
}: {
  highlines: Highline[] | null;
  cameraBounds: BBox;
  cameraZoom: number;
  highlightedMarker: Highline | null;
}): MarkerData => {
  const points = useMemo<Supercluster.PointFeature<PointProperties>[]>(() => {
    if (!highlines) return [];

    return highlines.map((highline) => ({
      type: 'Feature',
      properties: {
        cluster: false,
        category: 'highline',
        highID: highline.id,
        status: highline.status as RigStatuses,
      },
      geometry: {
        type: 'Point',
        coordinates: [highline.anchor_a_long, highline.anchor_a_lat],
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

  const clusters = useMemo<MarkerClusterList>(() => {
    return supercluster.getClusters(cameraBounds, clusterZoom);
  }, [supercluster, cameraBounds, clusterZoom]);

  /** Highlines whose Anchor A is an individual point in the current query. */
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
   * Detail geometry is rendered for visible points and for the highlighted
   * highline while the camera is transitioning between cluster states.
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

  /** Keep the focused Anchor A visible until the cluster query catches up. */
  const forcedHighlightedAnchorA = useMemo(() => {
    if (!highlightedMarker) return null;

    if (visibleAnchorAHighlineIds.has(highlightedMarker.id)) {
      return null;
    }

    return highlightedMarker;
  }, [highlightedMarker, visibleAnchorAHighlineIds]);

  /** Resolve distance, midpoint and coordinates once per derived detail set. */
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

  /** Build the single native point source for visible A and detail B anchors. */
  const anchorFeatures = useMemo<
    FeatureCollection<Point, AnchorProperties>
  >(() => {
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
  }, [clusters, detailFeatures, forcedHighlightedAnchorA, highlightedMarker]);

  const focusedDetail = useMemo(
    () => detailFeatures.find((detail) => detail.isHighlighted) ?? null,
    [detailFeatures],
  );

  return {
    points,
    supercluster,
    clusters,
    lineFeatures,
    anchorFeatures,
    focusedDetail,
  };
};
