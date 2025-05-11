import Mapbox from '@rnmapbox/maps';
import { useQuery } from '@tanstack/react-query';
import type { LineString, Position } from 'geojson';
import { useAtomValue } from 'jotai';
import { View } from 'react-native';

import { supabase } from '~/lib/supabase';

import { cameraStateAtom } from '~/components/map/utils';
import { Text } from '~/components/ui/text';

export type TTrailShape = GeoJSON.Feature<
  LineString,
  {
    name: string;
    color: string;
  }
>;

export const TrailShape: React.FC<{
  shape: TTrailShape;
}> = ({ shape }) => {
  const camera = useAtomValue(cameraStateAtom);

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

      {trailMiddleCoordinates && camera.zoom >= 14 && (
        <Mapbox.MarkerView
          coordinate={[trailMiddleCoordinates[0], trailMiddleCoordinates[1]]}
          anchor={{ x: 0.5, y: 1 }} // Anchor slightly above the point (adjust y)
          allowOverlap={true} // Allow tooltip to overlap markers/other elements
        >
          <View className="relative overflow-hidden rounded-md px-2 py-1">
            <View className="absolute inset-0 opacity-50 bg-slate-950"></View>
            <Text className="text-sm text-white">{shape.properties.name}</Text>
          </View>
        </Mapbox.MarkerView>
      )}
    </>
  );
};

export const ChooselifeTrails = () => {
  const CHOOSELIFE_TRAILS = [0, 1, 2, 3, 4, 5, 6, 7, 8];
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

  if (!trails || trails.length === 0) return null;

  return (
    <>
      {trails.map((t) => (
        <TrailShape
          key={t.id}
          shape={{
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
          }}
        />
      ))}
    </>
  );
};
