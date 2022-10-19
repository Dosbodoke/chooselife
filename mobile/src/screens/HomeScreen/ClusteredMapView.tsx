import * as Location from 'expo-location';
import { BBox, GeoJsonProperties } from 'geojson';
import { useState, useRef } from 'react';
import MapView, { Marker, Region } from 'react-native-maps';
import { PointFeature } from 'supercluster';
import useSuperCluster from 'use-supercluster';

import database from '../../database';
import ClusteredMarker from './ClusteredMarker';
import MyLocation from './MyLocation';
import { regionToBoundingBox } from './utils';

interface Props {
  buttonMarginBottom: number;
}

const getMyLocation = async (): Promise<Region | undefined> => {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') return;

  const { latitude, longitude } = (await Location.getCurrentPositionAsync({})).coords;
  const region = {
    latitude,
    longitude,
    latitudeDelta: 0.035,
    longitudeDelta: 0.035,
  };
  return region;
};

const minMarkerSize = 30;

const ClusteredMapView = ({ buttonMarginBottom }: Props) => {
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

  const points: PointFeature<GeoJsonProperties>[] = database?.highline.map((h) => ({
    type: 'Feature',
    properties: {
      cluster: false,
      category: 'highline',
      highId: h.id,
    },
    geometry: {
      type: 'Point',
      coordinates: [h.anchorA.longitude, h.anchorA.latitude],
    },
  }));

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
          const coordinate = { latitude, longitude };
          const properties = point.properties ?? {};

          if (properties?.cluster) {
            const size = Math.max((properties.point_count * 40) / points.length, minMarkerSize);
            return (
              <ClusteredMarker
                key={`cluster-${properties.cluster_id}`}
                size={size}
                coordinate={coordinate}
                pointCount={properties.point_count}
              />
            );
          }
          return <Marker key={`marker-${properties.highId}`} coordinate={coordinate} />;
        })}
      </MapView>
      <MyLocation mBottom={buttonMarginBottom} onPress={setMyLocation} />
    </>
  );
};

export default ClusteredMapView;
