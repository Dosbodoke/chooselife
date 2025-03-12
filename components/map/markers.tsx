import MapboxGL from '@rnmapbox/maps';
import { useQueryClient } from '@tanstack/react-query';
import type { Feature, GeoJsonProperties } from 'geojson';
import { useAtomValue } from 'jotai';
import React, { useCallback, useEffect, useMemo } from 'react';
import { View } from 'react-native';
import { PointFeature } from 'supercluster';
import useSuperCluster from 'use-supercluster';

import type { Highline } from '~/hooks/use-highline';
import { MarkerCL } from '~/lib/icons/MarkerCL';

import { Text } from '../ui/text';
import { cameraStateAtom, MIN_CLUSTER_SIZE } from './utils';

interface PointProperties {
  cluster: boolean;
  category: string;
  highID: string;
  anchorType: 'A' | 'B';
}

// Helper function to validate coordinates
const isValidCoordinate = (lng?: number, lat?: number): boolean => {
  return (
    typeof lng === 'number' &&
    typeof lat === 'number' &&
    !isNaN(lng) &&
    !isNaN(lat) &&
    lng >= -180 &&
    lng <= 180 &&
    lat >= -90 &&
    lat <= 90
  );
};

export const Markers: React.FC<{
  cameraRef: React.RefObject<MapboxGL.Camera>;
  highlines: Highline[] | null;
  highlightedMarker: Highline | null;
  updateMarkers: (highlines: Highline[], focused: Highline) => void;
}> = ({ cameraRef, highlines, highlightedMarker, updateMarkers }) => {
  const queryClient = useQueryClient();
  const cameraState = useAtomValue(cameraStateAtom);

  const points = useMemo<
    PointFeature<GeoJsonProperties & PointProperties>[]
  >(() => {
    if (!highlines) return [];
    return highlines
      .filter((h) => isValidCoordinate(h.anchor_a_long, h.anchor_a_lat))
      .map((h) => ({
        type: 'Feature',
        properties: {
          cluster: false,
          category: 'highline',
          highID: h.id,
          anchorType: 'A',
          anchorB: {
            latitude: h.anchor_b_lat,
            longitude: h.anchor_b_long,
          },
        },
        geometry: {
          type: 'Point',
          coordinates: [h.anchor_a_long, h.anchor_a_lat], // [lng, lat]
        },
      }));
  }, [highlines]);

  const { clusters, supercluster } = useSuperCluster({
    points,
    bounds: cameraState.bounds,
    zoom: cameraState.zoom,
    options: { radius: 20, maxZoom: 25 },
  });

  // Zoom into a cluster by computing bounds from its leaves.
  const handleClusterPress = useCallback(
    (cluster_id: number): void => {
      if (!supercluster) return;
      // Get the expansion zoom level, then clamp it to a maximum of 17.
      const expansionZoom =
        supercluster.getClusterExpansionZoom(cluster_id) || 20;
      const clampedZoom = Math.min(expansionZoom, 17);
      const cluster = clusters.find(
        (c) => c.properties.cluster && c.properties.cluster_id === cluster_id,
      );
      if (!cluster) return;
      const [lng, lat] = cluster.geometry.coordinates;

      // Optionally update markers if needed
      const shouldHighlightCards = clampedZoom <= cameraState.zoom;
      if (shouldHighlightCards) {
        const leaves = supercluster.getLeaves(cluster_id);
        const highlinesData =
          queryClient.getQueryData<Highline[]>(['highlines']) || [];
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
      }

      cameraRef.current?.setCamera({
        centerCoordinate: [lng, lat],
        zoomLevel: clampedZoom,
        animationDuration: 1000,
        animationMode: 'flyTo',
      });
    },
    [
      queryClient,
      supercluster,
      cameraState.zoom,
      cameraRef,
      updateMarkers,
      clusters,
    ],
  );

  // Adjust camera when a marker is highlighted.
  useEffect(() => {
    if (!highlightedMarker) return;
    if (
      !isValidCoordinate(
        highlightedMarker.anchor_a_long,
        highlightedMarker.anchor_a_lat,
      ) ||
      !isValidCoordinate(
        highlightedMarker.anchor_b_long,
        highlightedMarker.anchor_b_lat,
      )
    ) {
      return;
    }

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
    cameraRef.current?.fitBounds(ne, sw, [50, 50, 50, 50], 1000);
  }, [highlightedMarker, cameraRef]);

  const handleMarkerSelect = useCallback(
    (highID: string) => {
      const highline = (
        queryClient.getQueryData<Highline[]>(['highlines']) || []
      ).find((high) => high.id === highID);
      if (highline) {
        updateMarkers([highline], highline);
      }
    },
    [queryClient, updateMarkers],
  );

  // Generate polylines for all highlines
  const polylineFeatures = useMemo<Feature[]>(() => {
    if (!highlines) return [];

    return highlines
      .filter(
        (h) =>
          isValidCoordinate(h.anchor_a_long, h.anchor_a_lat) &&
          isValidCoordinate(h.anchor_b_long, h.anchor_b_lat),
      )
      .map((h) => ({
        type: 'Feature',
        geometry: {
          type: 'LineString',
          coordinates: [
            [h.anchor_a_long, h.anchor_a_lat],
            [h.anchor_b_long, h.anchor_b_lat],
          ],
        },
        properties: {
          highID: h.id,
          isRigged: h.status === 'rigged',
        },
      }));
  }, [highlines, highlightedMarker]);

  return (
    <>
      {/* Render all polylines */}
      {polylineFeatures.map((feature, index) => (
        <MapboxGL.ShapeSource
          key={`polyline-${feature.properties?.highID || index}`}
          id={`polyline-${feature.properties?.highID || index}`}
          shape={feature}
        >
          <MapboxGL.LineLayer
            id={`linelayer-${feature.properties?.highID || index}`}
            style={{
              // Blue is is highlited, green is rigged, red is not rigged.
              lineColor:
                feature.properties?.highID === highlightedMarker?.id
                  ? '#3b82f6'
                  : feature.properties?.isRigged
                    ? '#22c55e'
                    : '#ef4444',
              lineWidth: 3,
            }}
          />
        </MapboxGL.ShapeSource>
      ))}

      {clusters?.map((point) => {
        const coordinate = point.geometry.coordinates;
        const { properties } = point;

        if (properties?.cluster) {
          const size = Math.max(
            (properties.point_count * 40) / (points.length || 1),
            MIN_CLUSTER_SIZE,
          );
          return (
            <ClusteredMarker
              key={`cluster-${properties.cluster_id}`}
              size={size}
              coordinate={coordinate as [number, number]}
              pointCount={properties.point_count}
              onPress={() => handleClusterPress(properties.cluster_id)}
            />
          );
        }

        return (
          <MapboxGL.PointAnnotation
            key={`marker-high-${properties.highID}-A`}
            id={`marker-high-${properties.highID}-A`}
            coordinate={coordinate}
            onSelected={() => handleMarkerSelect(properties.highID)}
            anchor={{ y: 1, x: 0.5 }}
          >
            <View className="size-12">
              <MarkerCL active={properties?.highID === highlightedMarker?.id} />
            </View>
          </MapboxGL.PointAnnotation>
        );
      })}

      {/* Render anchorB of highlited marker */}
      {highlightedMarker ? (
        <MapboxGL.PointAnnotation
          key={`marker-high-${highlightedMarker.id}-B`}
          id={`marker-high-${highlightedMarker.id}-B`}
          coordinate={[
            highlightedMarker.anchor_b_long,
            highlightedMarker.anchor_b_lat,
          ]}
          onSelected={() => handleMarkerSelect(highlightedMarker.id)}
          anchor={{ y: 1, x: 0.5 }}
        >
          <View className="size-12">
            <MarkerCL active={true} />
          </View>
        </MapboxGL.PointAnnotation>
      ) : null}
    </>
  );
};

// Memoized ClusteredMarker to avoid unnecessary re-renders.
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
    <MapboxGL.PointAnnotation
      id={`cluster-${coordinate[0]}-${coordinate[1]}`}
      coordinate={coordinate}
      onSelected={onPress}
    >
      <View
        className="flex items-center justify-center rounded-full bg-popover shadow-lg"
        style={{ width: size, height: size, borderRadius: size / 2 }}
      >
        <Text className="text-center text-xl font-bold">{pointCount}</Text>
      </View>
    </MapboxGL.PointAnnotation>
  ),
);

export default Markers;
