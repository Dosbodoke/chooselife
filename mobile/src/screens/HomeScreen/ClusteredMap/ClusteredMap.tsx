import type { Coordinates } from '@src/database';
import database from '@src/database';
import { BBox, GeoJsonProperties } from 'geojson';
import { useState, useRef, useMemo } from 'react';
import MapView, { Region } from 'react-native-maps';
import { PointFeature } from 'supercluster';
import useSuperCluster from 'use-supercluster';


import { regionToBoundingBox, getMyLocation } from '../utils';
import ClusteredMarker from './ClusteredMarker';
import HighlineMarker from './HighlineMarker';
import MyLocation from './MyLocation';

interface PointProperties {
  cluster: boolean;
  category: string;
  highId: string;
  anchorB: Coordinates;
}

interface Props {
  buttonMarginBottom: number;
}

const minMarkerSize = 30;

const ClusteredMap = ({ buttonMarginBottom }: Props) => {
  const initialRegion = {
    latitude: -15.7782081,
    longitude: -47.93371,
    latitudeDelta: 5,
    longitudeDelta: 5,
  };
  const initialBound = regionToBoundingBox(initialRegion);

  const [bounds, setBounds] = useState<BBox>(initialBound);
  const [zoom, setZoom] = useState(10);

  const mapRef = useRef<MapView>(null);

  const setMyLocation = async () => {
    const region = await getMyLocation();
    region && mapRef.current?.animateToRegion(region, 1000);
  };

  const onRegionChangeComplete = async (region: Region) => {
    const mapBound = regionToBoundingBox(region);
    const coords = await mapRef.current?.getCamera();
    setZoom(coords?.zoom ?? 10);
    setBounds(mapBound);
  };

  const fitMapToPolyline = (coords: Coordinates[]): void => {
    mapRef.current?.fitToCoordinates(coords, {
      edgePadding: {
        top: 0,
        right: 50,
        bottom: 100,
        left: 50,
      },
    });
  };

  const points = useMemo<PointFeature<GeoJsonProperties & PointProperties>[]>(() => {
    return database?.highline.map((h) => ({
      type: 'Feature',
      properties: {
        cluster: false,
        category: 'highline',
        highId: h.id,
        anchorB: h.anchorB,
      },
      geometry: {
        type: 'Point',
        coordinates: [h.anchorA.longitude, h.anchorA.latitude],
      },
    }));
  }, [database?.highline]);

  const { clusters } = useSuperCluster({
    points,
    bounds,
    zoom,
    options: { radius: 75, maxZoom: 25 },
  });

  return (
    <>
      <MapView
        className="flex-1"
        testID="MapView"
        provider="google"
        initialRegion={initialRegion}
        ref={mapRef}
        onRegionChangeComplete={onRegionChangeComplete}
        showsUserLocation>
        {clusters?.map((point) => {
          const [longitude, latitude] = point.geometry.coordinates;
          const coordinateA = { latitude, longitude };
          const properties = point.properties;

          if (properties?.cluster) {
            const size = Math.max((properties.point_count * 40) / points.length, minMarkerSize);
            return (
              <ClusteredMarker
                key={`cluster-${properties.cluster_id}`}
                size={size}
                coordinate={coordinateA}
                pointCount={properties.point_count}
              />
            );
          }

          const coordinateB = {
            latitude: properties.anchorB.latitude,
            longitude: properties.anchorB.longitude,
          };
          return (
            <HighlineMarker
              key={`marker-${properties.highId}`}
              coordinateA={coordinateA}
              coordinateB={coordinateB}
              fitMapToPolyline={fitMapToPolyline}
            />
          );
        })}
      </MapView>
      <MyLocation mBottom={buttonMarginBottom} onPress={setMyLocation} />
    </>
  );
};

export default ClusteredMap;
