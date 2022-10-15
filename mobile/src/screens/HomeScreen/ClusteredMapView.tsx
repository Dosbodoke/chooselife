import { BBox, GeoJsonProperties } from 'geojson';
import { useState, useRef } from 'react';
import MapView, { Marker, Region } from 'react-native-maps';
import { PointFeature } from 'supercluster';
import useSuperCluster from 'use-supercluster';

import database from '../../database';
import ClusteredMarker from './ClusteredMarker';
import { regionToBoundingBox } from './utils';

interface Props {
  initialRegion: Region;
}

const minMarkerSize = 30;

const ClusteredMapView = ({ initialRegion }: Props) => {
  const mapRef = useRef<MapView>(null);
  const initialBound = regionToBoundingBox(initialRegion);
  const [bounds, setBounds] = useState<BBox>(initialBound);
  const [zoom, setZoom] = useState(10);

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
    <MapView
      className="flex-1"
      initialRegion={initialRegion}
      provider="google"
      ref={mapRef}
      showsUserLocation
      onRegionChangeComplete={onRegionChangeComplete}>
      {clusters?.map((point) => {
        const [longitude, latitude] = point.geometry.coordinates;
        const coordinate = { latitude, longitude };
        const properties = point.properties ?? {};

        if (properties?.cluster) {
          const size = Math.max((properties.point_count * 40) / points.length, minMarkerSize);
          return (
            <ClusteredMarker
              key={`cluster-${properties.highId}`}
              size={size}
              coordinate={coordinate}
              pointCount={properties.point_count}
            />
          );
        }
        return <Marker key={`cluster-${properties.highId}`} coordinate={coordinate} />;
      })}
    </MapView>
  );
};

export default ClusteredMapView;
