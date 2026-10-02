import type { RigStatuses } from '@chooselife/ui';
import Mapbox from '@rnmapbox/maps';
import { Link } from 'expo-router';
import type { Position } from 'geojson';
import { MapIcon, NavigationIcon } from 'lucide-react-native';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Linking, Platform, TouchableOpacity, View } from 'react-native';

import { lineStatusColor } from '~/components/map/marker-data';
import { StyledSquircle } from '~/components/styled';
import { Icon } from '~/components/ui/icon';
import { Text } from '~/components/ui/text';

const MAP_HEIGHT = 240;
const CAMERA_PADDING = 60;
/** Short lines would otherwise zoom past the point where tiles carry detail. */
const MAX_ZOOM = 17.5;

interface LocationMapCardProps {
  highlineId: string;
  name: string;
  /** `[longitude, latitude]` */
  anchorA: Position;
  /** `[longitude, latitude]` - optional, older highlines only store one end. */
  anchorB?: Position;
  status: RigStatuses | null;
}

const openDirections = ([longitude, latitude]: Position, name: string) => {
  const url =
    Platform.OS === 'ios'
      ? `https://maps.apple.com/?daddr=${latitude},${longitude}&q=${encodeURIComponent(name)}`
      : `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`;
  Linking.openURL(url);
};

const HighlineCamera: React.FC<{ anchorA: Position; anchorB?: Position }> = ({
  anchorA,
  anchorB,
}) => {
  if (!anchorB) {
    return (
      <Mapbox.Camera
        centerCoordinate={anchorA}
        zoomLevel={16}
        animationMode="none"
        animationDuration={0}
      />
    );
  }

  return (
    <Mapbox.Camera
      bounds={{
        ne: [
          Math.max(anchorA[0], anchorB[0]),
          Math.max(anchorA[1], anchorB[1]),
        ],
        sw: [
          Math.min(anchorA[0], anchorB[0]),
          Math.min(anchorA[1], anchorB[1]),
        ],
        paddingLeft: CAMERA_PADDING,
        paddingRight: CAMERA_PADDING,
        paddingTop: CAMERA_PADDING,
        paddingBottom: CAMERA_PADDING,
      }}
      maxZoomLevel={MAX_ZOOM}
      animationMode="none"
      animationDuration={0}
    />
  );
};

/**
 * Drawn the same way as the explorer: a dark casing under the status-coloured
 * line so it survives any satellite tile, unrigged lines dashed, anchor A
 * filled and anchor B hollow.
 */
const HighlineShape: React.FC<{
  anchorA: Position;
  anchorB?: Position;
  status: RigStatuses | null;
}> = ({ anchorA, anchorB, status }) => {
  const color = status ? lineStatusColor[status] : '#000000';

  return (
    <>
      {anchorB ? (
        <Mapbox.ShapeSource
          id="locationMapCardLine"
          shape={{
            type: 'Feature',
            geometry: { type: 'LineString', coordinates: [anchorA, anchorB] },
            properties: {},
          }}
        >
          <Mapbox.LineLayer
            id="locationMapCardLineCasing"
            style={{
              lineColor: '#0A0A0A',
              lineOpacity: 0.55,
              lineWidth: 7,
              lineCap: 'round',
            }}
          />
          <Mapbox.LineLayer
            id="locationMapCardLineStroke"
            style={{
              lineColor: color,
              lineWidth: 4,
              lineCap: 'round',
              ...(status === 'unrigged' && { lineDasharray: [2.2, 1.4] }),
            }}
          />
        </Mapbox.ShapeSource>
      ) : null}
      <Mapbox.ShapeSource
        id="locationMapCardAnchors"
        shape={{
          type: 'FeatureCollection',
          features: [anchorA, anchorB]
            .filter((position): position is Position => !!position)
            .map((position, index) => ({
              type: 'Feature',
              geometry: { type: 'Point', coordinates: position },
              properties: { end: index === 0 ? 'a' : 'b' },
            })),
        }}
      >
        <Mapbox.CircleLayer
          id="locationMapCardAnchorCircles"
          style={{
            circleRadius: 7,
            circleColor: [
              'case',
              ['==', ['get', 'end'], 'a'],
              color,
              '#FFFFFF',
            ],
            circleStrokeColor: [
              'case',
              ['==', ['get', 'end'], 'a'],
              '#FFFFFF',
              color,
            ],
            circleStrokeWidth: 2.5,
          }}
        />
      </Mapbox.ShapeSource>
    </>
  );
};

/**
 * Non-interactive map preview of the highline with its two actions: jump to
 * the line in the explorer, or hand off to the platform maps app for
 * directions.
 *
 * Always satellite, regardless of the explorer's map-type preference: at the
 * zoom a single line needs, vector styles are mostly flat fill, while
 * satellite shows the terrain the line actually crosses.
 */
export const LocationMapCard: React.FC<LocationMapCardProps> = ({
  highlineId,
  name,
  anchorA,
  anchorB,
  status,
}) => {
  const { t } = useTranslation();

  return (
    <StyledSquircle
      className="bg-white rounded-3xl overflow-hidden"
      cornerSmoothing={0.8}
    >
      <Mapbox.MapView
        styleURL={Mapbox.StyleURL.SatelliteStreet}
        scrollEnabled={false}
        rotateEnabled={false}
        pitchEnabled={false}
        zoomEnabled={false}
        compassEnabled={false}
        scaleBarEnabled={false}
        logoEnabled={false}
        attributionEnabled={false}
        style={{ width: '100%', height: MAP_HEIGHT }}
      >
        <HighlineCamera anchorA={anchorA} anchorB={anchorB} />
        <HighlineShape anchorA={anchorA} anchorB={anchorB} status={status} />
      </Mapbox.MapView>

      <View className="absolute bottom-3 left-3 right-3 flex-row gap-2">
        <Link
          href={{ pathname: '/(tabs)', params: { focusedMarker: highlineId } }}
          asChild
        >
          <TouchableOpacity
            activeOpacity={0.8}
            className="flex-1 flex-row items-center justify-center gap-2 bg-white/95 rounded-full py-2.5 shadow"
          >
            <Icon as={MapIcon} className="size-4 text-foreground" />
            <Text className="text-sm font-semibold text-foreground">
              {t('components.highline.location-weather-card.explorer')}
            </Text>
          </TouchableOpacity>
        </Link>
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => openDirections(anchorA, name)}
          className="flex-1 flex-row items-center justify-center gap-2 bg-blue-500 rounded-full py-2.5 shadow"
        >
          <Icon as={NavigationIcon} className="size-4 text-white" />
          <Text className="text-sm font-semibold text-white">
            {t('components.highline.location-weather-card.directions')}
          </Text>
        </TouchableOpacity>
      </View>
    </StyledSquircle>
  );
};
