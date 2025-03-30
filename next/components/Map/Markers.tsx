"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { BBox, GeoJsonProperties } from "geojson";
import L from "leaflet";
import { SearchIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useQueryState } from "nuqs";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import ReactDOMServer from "react-dom/server";
import { Marker, Polyline, useMap, useMapEvents } from "react-leaflet";
import type { PointFeature } from "supercluster";
import useSupercluster from "use-supercluster";

import { getHighline } from "@/app/actions/getHighline";
import useSupabaseBrowser from "@/utils/supabase/client";

interface PointProperties {
  cluster: boolean;
  category: string;
  id: string;
}

const locationToBoundingBox = (location: L.LatLngBounds): BBox => {
  return [
    location.getSouthWest().lng,
    location.getSouthWest().lat,
    location.getNorthEast().lng,
    location.getNorthEast().lat,
  ];
};

export const Markers = ({
  focusedMarker,
  setHighlineIds,
}: {
  focusedMarker: string | null;
  setHighlineIds: React.Dispatch<React.SetStateAction<string[]>>;
}) => {
  const t = useTranslations("map.refetch");
  const queryClient = useQueryClient();
  const supabase = useSupabaseBrowser();
  const [, setFocusedMarker] = useQueryState("focusedMarker");
  const map = useMap();
  const [canRefetch, setCanRefetch] = useState(false);
  const [bounds, setBounds] = useState<BBox>();

  const {
    data: highlines,
    isFetching,
    refetch,
  } = useQuery({
    queryKey: ["bounds"],
    queryFn: async () => {
      if (!bounds) return [];
      const { data, error } = await supabase.rpc("highlines_in_view", {
        min_long: bounds[0],
        min_lat: bounds[1],
        max_long: bounds[2],
        max_lat: bounds[3],
      });
      if (error) throw new Error(error.message);
      setCanRefetch(false);
      return data;
    },
  });

  const points = useMemo<
    PointFeature<GeoJsonProperties & PointProperties>[]
  >(() => {
    if (!highlines) return [];

    return highlines.map((high) => ({
      type: "Feature",
      properties: {
        cluster: false,
        category: "highline",
        id: high.id,
      },
      geometry: {
        type: "Point",
        coordinates: [high.anchor_a_long, high.anchor_a_lat],
      },
    }));
  }, [highlines]);

  const { clusters, supercluster } = useSupercluster({
    points: points,
    bounds: bounds,
    zoom: map.getZoom(),
    options: { radius: 75, maxZoom: 20 },
  });

  useMapEvents({
    moveend() {
      const bounds = locationToBoundingBox(map.getBounds());
      setBounds(bounds);
      setCanRefetch(true);
    },
    click() {
      if (focusedMarker) {
        setFocusedMarker(null);
      }
      setHighlineIds([]);
    },
  });

  function fetchIcon({ count, size }: { count: number; size: number }) {
    return L.divIcon({
      html: ReactDOMServer.renderToString(
        <div
          className="grid place-items-center rounded-full bg-accent text-base text-accent-foreground"
          style={{ width: size, height: size }}
        >
          {count}
        </div>
      ),
    });
  }

  const openMarkerDetails = useCallback(
    async (highlineIds: string[]) => {
      setFocusedMarker(highlineIds[0]);
      setHighlineIds(highlineIds);
    },
    [setFocusedMarker, setHighlineIds]
  );

  useEffect(() => {
    async function ensureFocusedMarkerData() {
      if (!focusedMarker) return;
      if (!highlines?.find((high) => high.id === focusedMarker)) {
        const { data } = await queryClient.ensureQueryData({
          queryKey: ["highline", focusedMarker],
          queryFn: () => getHighline({ id: [focusedMarker] }),
        });
        if (data && data.length === 1) {
          map.setView([data[0].anchor_a_lat, data[0].anchor_a_long], 18);
          setHighlineIds([focusedMarker]);
          refetch();
        }
      }
    }
    ensureFocusedMarkerData();
  }, [focusedMarker, highlines, map, queryClient, refetch, setHighlineIds]);

  const focusedHigline = useMemo(() => {
    return focusedMarker && highlines
      ? highlines.find((h) => h.id === focusedMarker)
      : null;
  }, [focusedMarker, highlines]);

  useEffect(() => {
    // Ensure focusedHighline exists and matches the clicked marker
    if (focusedHigline) {
      const bounds = L.latLngBounds(
        [focusedHigline.anchor_a_lat, focusedHigline.anchor_a_long],
        [focusedHigline.anchor_b_lat, focusedHigline.anchor_b_long]
      );
      map.fitBounds(bounds, {
        animate: true,
        paddingBottomRight: [96, 96],
        duration: 300,
      });
    }
  }, [focusedHigline, map]);

  return (
    <>
      {clusters.map((cluster) => {
        const [longitude, latitude] = cluster.geometry.coordinates;
        const { cluster: isCluster, point_count: pointCount } =
          cluster.properties;

        if (isCluster) {
          if (!supercluster || typeof cluster.id !== "number") return;
          const highlineIds = supercluster
            .getLeaves(cluster.id)
            .map((h) => h.properties.id as string);

          return (
            <Marker
              key={`cluster-${cluster.id}`}
              position={[latitude, longitude]}
              eventHandlers={{
                click: () => {
                  const expansionZoom = Math.min(
                    supercluster.getClusterExpansionZoom(
                      cluster.properties.cluster_id
                    ),
                    17
                  );
                  map.setView([latitude, longitude], expansionZoom, {
                    animate: true,
                  });

                  // If is clustered and can't zoom more
                  if (expansionZoom === 17) {
                    openMarkerDetails(highlineIds);
                  }
                },
              }}
              icon={fetchIcon({
                count: pointCount,
                size: 10 + (pointCount / points.length) * 40,
              })}
            />
          );
        }

        return (
          <Marker
            key={`highline-${cluster.properties.id}`}
            position={[latitude, longitude]}
            eventHandlers={{
              click: () => {
                openMarkerDetails([cluster.properties.id]);
              },
            }}
          />
        );
      })}

      {focusedHigline ? (
        <>
          <Marker
            position={[
              focusedHigline.anchor_b_lat,
              focusedHigline.anchor_b_long,
            ]}
          />
          <Polyline
            positions={[
              [focusedHigline.anchor_a_lat, focusedHigline.anchor_a_long],
              [focusedHigline.anchor_b_lat, focusedHigline.anchor_b_long],
            ]}
            dashArray={[20, 10]}
            color="#000000"
          />
        </>
      ) : null}

      <button
        className="absolute left-1/2 top-12 z-[1000] flex -translate-x-1/2 items-center gap-2 rounded-3xl bg-white px-3 py-2 text-sm text-black shadow-lg aria-hidden:hidden"
        aria-hidden={!canRefetch}
        onClick={() => {
          refetch();
        }}
      >
        <p className="font-medium">
          {isFetching ? t("pending") : t("enabled")}
        </p>
        <div className="h-5 w-5">
          <SearchIcon className="h-full w-full text-blue-500" />
        </div>
      </button>
    </>
  );
};
