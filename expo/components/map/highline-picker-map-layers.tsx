import Mapbox from '@rnmapbox/maps';
import {
  selectPendingMapLines,
  type PendingMapLineProjection,
} from '~/features/highline-registration/state/selectors';
import { useRegistrationState } from '~/features/highline-registration/state/store';
import { useMapStore } from '~/store/map-store';
import type { Feature, FeatureCollection, LineString, Point } from 'geojson';
import React, { useMemo } from 'react';
import { View } from 'react-native';

import { useAuth } from '~/context/auth';

import { Text } from '../ui/text';

type PendingStatus = PendingMapLineProjection['status'];
type PendingLineProperties = { status: PendingStatus };
type PendingAnchorProperties = {
  status: PendingStatus;
  end: 'a' | 'b';
};
type PendingLineFeature = Feature<LineString, PendingLineProperties>;
type PendingAnchorFeature = Feature<Point, PendingAnchorProperties>;

const EMPTY_COLLECTION: FeatureCollection<LineString, PendingLineProperties> = {
  type: 'FeatureCollection',
  features: [],
};

const EMPTY_ANCHOR_COLLECTION: FeatureCollection<
  Point,
  PendingAnchorProperties
> = {
  type: 'FeatureCollection',
  features: [],
};

const PickerAnchor: React.FC<{
  coordinate: [number, number];
  end: 'a' | 'b';
}> = ({ coordinate, end }) => (
  <Mapbox.PointAnnotation
    id={`picker-anchor-${end}`}
    coordinate={coordinate}
    anchor={{ x: 0.5, y: 1 }}
  >
    <View
      pointerEvents="none"
      className="size-9 items-center justify-center rounded-full border-2 border-white bg-red-600 shadow-lg"
    >
      <Text className="text-sm font-extrabold text-white">
        {end.toUpperCase()}
      </Text>
    </View>
  </Mapbox.PointAnnotation>
);

const PickerGeometry: React.FC<{
  anchorA: [number, number] | null;
  anchorB: [number, number] | null;
  adjustingAnchor: 'a' | 'b' | null;
  center: [number, number];
}> = ({ anchorA, anchorB, adjustingAnchor, center }) => {
  const lineCoordinates = useMemo(() => {
    if (adjustingAnchor === 'a' && anchorB) {
      return [center, anchorB] as [number, number][];
    }

    if (!anchorA) return null;
    return [anchorA, anchorB ?? center] as [number, number][];
  }, [anchorA, anchorB, adjustingAnchor, center]);

  const lineFeatureCollection = useMemo<
    FeatureCollection<LineString, { status: string }>
  >(
    () =>
      lineCoordinates
        ? {
            type: 'FeatureCollection',
            features: [
              {
                type: 'Feature',
                geometry: {
                  type: 'LineString',
                  coordinates: lineCoordinates,
                },
                properties: { status: 'picker' },
              },
            ],
          }
        : EMPTY_COLLECTION,
    [lineCoordinates],
  );

  return (
    <>
      {lineCoordinates ? (
        <Mapbox.ShapeSource
          id="highline-picker-line-source"
          shape={lineFeatureCollection}
        >
          <Mapbox.LineLayer
            id="highline-picker-line"
            style={{
              lineColor: '#F8FAFC',
              lineWidth: 4,
              lineDasharray: [2, 2],
              lineCap: 'round',
              lineOpacity: 0.95,
            }}
          />
        </Mapbox.ShapeSource>
      ) : null}

      {anchorA && adjustingAnchor !== 'a' ? (
        <PickerAnchor coordinate={anchorA} end="a" />
      ) : null}
      {anchorB && adjustingAnchor !== 'b' ? (
        <PickerAnchor coordinate={anchorB} end="b" />
      ) : null}
    </>
  );
};

const PendingHighlineLines: React.FC<{
  lines: PendingMapLineProjection[];
}> = ({ lines }) => {
  const lineFeatureCollection = useMemo<
    FeatureCollection<LineString, PendingLineProperties>
  >(
    () => ({
      type: 'FeatureCollection',
      features: lines.map(
        (line) =>
          ({
            type: 'Feature',
            geometry: {
              type: 'LineString',
              coordinates: [line.anchorA, line.anchorB],
            },
            properties: { status: line.status },
          }) as PendingLineFeature,
      ),
    }),
    [lines],
  );

  const anchorFeatureCollection = useMemo<
    FeatureCollection<Point, PendingAnchorProperties>
  >(
    () =>
      lines.length === 0
        ? EMPTY_ANCHOR_COLLECTION
        : {
            type: 'FeatureCollection',
            features: lines.flatMap(
              (line) =>
                [
                  {
                    type: 'Feature',
                    id: `${line.id}-a`,
                    geometry: {
                      type: 'Point',
                      coordinates: line.anchorA,
                    },
                    properties: { status: line.status, end: 'a' },
                  },
                  {
                    type: 'Feature',
                    id: `${line.id}-b`,
                    geometry: {
                      type: 'Point',
                      coordinates: line.anchorB,
                    },
                    properties: { status: line.status, end: 'b' },
                  },
                ] as PendingAnchorFeature[],
            ),
          },
    [lines],
  );

  if (lineFeatureCollection.features.length === 0) return null;

  return (
    <>
      <Mapbox.ShapeSource
        id="highline-picker-pending-lines-source"
        shape={lineFeatureCollection}
      >
        <Mapbox.LineLayer
          id="highline-picker-pending-lines"
          style={{
            lineColor: [
              'match',
              ['get', 'status'],
              'needs-attention',
              '#DC2626',
              '#F59E0B',
            ],
            lineWidth: 3,
            lineDasharray: [1.5, 1.5],
            lineCap: 'round',
            lineOpacity: 0.9,
          }}
        />
      </Mapbox.ShapeSource>
      <Mapbox.ShapeSource
        id="highline-picker-pending-anchors-source"
        shape={anchorFeatureCollection}
      >
        <Mapbox.CircleLayer
          id="highline-picker-pending-anchors"
          style={{
            circleRadius: ['match', ['get', 'end'], 'a', 6, 5],
            circleColor: [
              'match',
              ['get', 'status'],
              'needs-attention',
              '#DC2626',
              '#F59E0B',
            ],
            circleStrokeColor: '#FFFFFF',
            circleStrokeWidth: 2,
            circlePitchAlignment: 'map',
          }}
        />
      </Mapbox.ShapeSource>
    </>
  );
};

const RegistrationPendingLines: React.FC<{ ownerId: string }> = ({
  ownerId,
}) => {
  const { state: registration } = useRegistrationState(ownerId);
  const pendingLines = useMemo(
    () => selectPendingMapLines(registration),
    [registration],
  );

  return <PendingHighlineLines lines={pendingLines} />;
};

/**
 * Native map children for the inline picker and the normal map's durable
 * registration queue. The fixed center marker is a sibling overlay, so only
 * committed anchors and their live line belong here.
 *
 * Registration state is keyed by the authenticated owner. Keeping the hook in
 * a keyed child prevents the mount-only persistence load from ever creating or
 * retaining an anonymous outbox while auth is resolving.
 */
export const HighlinePickerMapLayers: React.FC = () => {
  const { profile, session: authSession, sessionLoading } = useAuth();
  const ownerId = authSession?.user.id ?? profile?.id;
  const cameraCenter = useMapStore((state) => state.camera.center);
  const pickerSession = useMapStore((state) => state.locationPickerSession);

  return (
    <>
      {ownerId && !sessionLoading ? (
        <RegistrationPendingLines key={ownerId} ownerId={ownerId} />
      ) : null}
      {pickerSession ? (
        <PickerGeometry
          anchorA={pickerSession.anchorA}
          anchorB={pickerSession.anchorB}
          adjustingAnchor={pickerSession.adjustingAnchor}
          center={cameraCenter as [number, number]}
        />
      ) : null}
    </>
  );
};
