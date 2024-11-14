import { useQueryClient } from "@tanstack/react-query";
import { RefObject, useEffect, useMemo } from "react";
import { View } from "react-native";
import MapView, { LatLng, Marker, Polyline } from "react-native-maps";
import { PointFeature } from "supercluster";
import useSuperCluster from "use-supercluster";
import type { BBox, GeoJsonProperties } from "geojson";

import { Text } from "../ui/text";
import { type Highline } from "~/hooks/use-highline";
import { MarkerCL } from "~/lib/icons/MarkerCL";

const MIN_MARKER_SIZE = 30;
interface PointProperties {
  cluster: boolean;
  category: string;
  highID: string;
  anchorB: LatLng;
}

interface Props {
  mapRef: RefObject<MapView>;
  highlines: Highline[] | null;
  highlightedMarker: Highline | null;
  zoom: number;
  bounds: BBox;
  updateMarkers: (highlines: Highline[], focused: Highline) => void;
}

export const Markers = ({
  mapRef,
  highlines,
  highlightedMarker,
  zoom,
  bounds,
  updateMarkers,
}: Props) => {
  const queryClient = useQueryClient();

  const handleClusterPress = (cluster_id: number): void => {
    // Check if user can zoom more in the current cluster
    const expansionZoom = Math.min(
      supercluster?.getClusterExpansionZoom(cluster_id) || 20,
      17
    );
    const shouldHighlightCards = expansionZoom <= zoom;

    // Set highlines
    const leaves = supercluster?.getLeaves(cluster_id);
    const highlines: Highline[] = [];
    const coordinates: LatLng[] = [];
    if (leaves) {
      leaves.forEach((l) => {
        if (shouldHighlightCards) {
          const highline = queryClient
            .getQueryData<Highline[]>(["highlines"])
            ?.find((high) => high.id === l.properties.highID);
          if (highline) highlines.push(highline);
        }
        coordinates.push(l.properties.anchorB);
        coordinates.push({
          longitude: l.geometry.coordinates[0],
          latitude: l.geometry.coordinates[1],
        });
      });

      // Only highlight the first marker if the cluster can't be zoomed anymore
      if (shouldHighlightCards) {
        updateMarkers(highlines, highlines[0]);
      }

      mapRef.current?.fitToCoordinates(coordinates, {
        edgePadding: {
          top: 200,
          right: 50,
          bottom: 250,
          left: 50,
        },
        animated: true,
      });
    }
  };

  // Handle marker highlightning
  useEffect(() => {
    if (highlightedMarker === null) return;
    mapRef.current?.fitToCoordinates(
      [
        {
          latitude: highlightedMarker.anchor_a_lat,
          longitude: highlightedMarker.anchor_a_long,
        },
        {
          latitude: highlightedMarker.anchor_b_lat,
          longitude: highlightedMarker.anchor_b_long,
        },
      ],
      {
        edgePadding: {
          top: 200,
          right: 50,
          bottom: 250,
          left: 50,
        },
        animated: true,
      }
    );
  }, [highlightedMarker]);

  const points = useMemo<
    PointFeature<GeoJsonProperties & PointProperties>[]
  >(() => {
    if (!highlines) return [];
    return highlines.map((h) => {
      return {
        type: "Feature",
        properties: {
          cluster: false,
          category: "highline",
          highID: h.id,
          anchorB: {
            latitude: h.anchor_b_lat,
            longitude: h.anchor_b_long,
          },
        },
        geometry: {
          type: "Point",
          coordinates: [h.anchor_a_long, h.anchor_a_lat], // [lng, lat]
        },
      };
    });
  }, [highlines]);

  const { clusters, supercluster } = useSuperCluster({
    points,
    bounds,
    zoom,
    options: { radius: 50, maxZoom: 25 },
  });

  return (
    <>
      {clusters?.map((point) => {
        const [longitude, latitude] = point.geometry.coordinates;
        if (typeof longitude !== "number" || typeof latitude !== "number")
          return;
        const coordinateA = { latitude, longitude };
        const properties = point.properties;

        if (properties?.cluster) {
          const size = Math.max(
            (properties.point_count * 40) / (points.length || 1),
            MIN_MARKER_SIZE
          );
          return (
            <ClusteredMarker
              key={`cluster-${properties.cluster_id}`}
              size={size}
              coordinate={coordinateA}
              pointCount={properties.point_count}
              onPress={() => handleClusterPress(properties.cluster_id)}
            />
          );
        }

        return (
          <Marker
            key={`marker-high-${properties.highID}-A`}
            coordinate={coordinateA}
            onPress={async (e) => {
              e.stopPropagation();
              const highline = queryClient
                .getQueryData<Highline[]>(["highlines"])
                ?.find((high) => high.id === properties.highID);
              if (highline) {
                updateMarkers([highline], highline);
              }
            }}
          >
            <View className="size-12">
              <MarkerCL
                props={{}}
                active={properties.highID === highlightedMarker?.id}
              />
            </View>
          </Marker>
        );
      })}

      {highlightedMarker ? (
        <>
          <Marker
            key={`marker-high-${highlightedMarker.id}-B`}
            coordinate={{
              latitude: highlightedMarker.anchor_b_lat,
              longitude: highlightedMarker.anchor_b_long,
            }}
          >
            <View className="size-12">
              <MarkerCL props={{}} active={true} />
            </View>
          </Marker>
          <Polyline
            strokeWidth={3}
            coordinates={[
              {
                latitude: highlightedMarker.anchor_a_lat,
                longitude: highlightedMarker.anchor_a_long,
              },
              {
                latitude: highlightedMarker.anchor_b_lat,
                longitude: highlightedMarker.anchor_b_long,
              },
            ]}
          />
        </>
      ) : null}
    </>
  );
};

const ClusteredMarker = ({
  coordinate,
  pointCount,
  size,
  onPress,
}: {
  coordinate: { latitude: number; longitude: number };
  pointCount: number;
  size: number;
  onPress: () => void;
}) => {
  return (
    <Marker coordinate={coordinate} onPress={onPress}>
      <View
        className="flex items-center justify-center rounded-full bg-popover shadow-lg"
        style={{ width: size, height: size }}
      >
        <Text className="text-center text-xl font-bold">{pointCount}</Text>
      </View>
    </Marker>
  );
};
