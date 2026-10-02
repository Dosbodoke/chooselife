import Mapbox from '@rnmapbox/maps';
import { useQuery } from '@tanstack/react-query';
import { useMapStore } from '~/store/map-store';
import type { LineString, Position } from 'geojson';
import React, { useMemo } from 'react';
import { View } from 'react-native';

import { supabase } from '~/lib/supabase';

import { Text } from '~/components/ui/text';

const CHOOSELIFE_TRAILS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 10];

/** Zoom at which a trail is close enough to be worth naming on the map. */
const TRAIL_LABEL_MIN_ZOOM = 14;

export type TTrailShape = GeoJSON.Feature<
  LineString,
  {
    name: string;
    color: string;
  }
>;

export const TrailShape: React.FC<{
  shape: TTrailShape;
}> = React.memo(({ shape }) => {
  // Selecting the predicate rather than the camera keeps these ten components
  // out of every camera event; the boolean only flips when crossing the zoom.
  const showTrailLabel = useMapStore(
    (state) => state.camera.zoom >= TRAIL_LABEL_MIN_ZOOM,
  );

  const trailMiddleCoordinates =
    shape.geometry.coordinates[
      Math.floor(shape.geometry.coordinates.length / 2)
    ];

  return (
    <>
      <Mapbox.ShapeSource
        id={`${shape.id}-source`}
        shape={shape}
        hitbox={{ width: 42, height: 42 }}
      >
        <Mapbox.LineLayer
          id={`${shape.id}-layer}`}
          style={{
            lineWidth: 3,
            lineCap: 'round',
            lineJoin: 'round',
            lineColor: shape.properties.color,
          }}
        />
      </Mapbox.ShapeSource>

      {trailMiddleCoordinates && showTrailLabel && (
        <Mapbox.MarkerView
          coordinate={[trailMiddleCoordinates[0], trailMiddleCoordinates[1]]}
          anchor={{ x: 0.5, y: 1 }} // Anchor slightly above the point (adjust y)
          allowOverlap // Allow tooltip to overlap markers/other elements
          allowOverlapWithPuck // ...and not vanish next to the location puck
        >
          <View className="relative overflow-hidden rounded-md px-2 py-1">
            <View className="absolute inset-0 opacity-50 bg-slate-950"></View>
            <Text className="text-sm text-white">{shape.properties.name}</Text>
          </View>
        </Mapbox.MarkerView>
      )}
    </>
  );
});

TrailShape.displayName = 'TrailShape';

export const ChooselifeTrails = React.memo(() => {
  const { data: trails } = useQuery({
    queryKey: ['trails'],
    queryFn: async () => {
      const response = await supabase
        .from('trails')
        .select('*')
        .in('id', CHOOSELIFE_TRAILS);

      return response.data;
    },
    staleTime: 24 * 60 * 60 * 1000, // 1 day
    gcTime: Infinity, // keep in memory
  });

  // Built once per query result. Rebuilding these objects per render would
  // hand Mapbox a new `shape` every time and make it re-upload each source.
  const shapes = useMemo<TTrailShape[]>(
    () =>
      (trails ?? []).map((t) => ({
        id: t.id,
        type: 'Feature',
        properties: {
          name: t.name,
          color: t.color,
        },
        geometry: {
          type: 'LineString',
          coordinates: t.coordinates as unknown as Position[],
        },
      })),
    [trails],
  );

  if (shapes.length === 0) return null;

  return (
    <>
      {shapes.map((shape) => (
        <TrailShape key={shape.id} shape={shape} />
      ))}
    </>
  );
});

ChooselifeTrails.displayName = 'ChooselifeTrails';
