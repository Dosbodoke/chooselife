import { MIN_MARKER_SIZE, INITIAL_REGION } from '@src/constants';
import type { Coordinates } from '@src/database';
import database from '@src/database';
import { useAppSelector } from '@src/redux/hooks';
import { BBox, GeoJsonProperties } from 'geojson';
import { useState, useRef, useMemo, useEffect, forwardRef, useImperativeHandle } from 'react';
import MapView, { Details, Camera, Region } from 'react-native-maps';
import { PointFeature } from 'supercluster';
import useSuperCluster from 'use-supercluster';

import { selectHighlitedMarker, selectMapType } from '../../mapSlice';
import { regionToBoundingBox, getMyLocation } from '../../utils';
import ClusteredMarker from './Marker/ClusteredMarker';
import HighlineMarker from './Marker/HighlineMarker';

import { trpc } from '../../../../utils/trpc';

interface PointProperties {
  cluster: boolean;
  category: string;
  highId: string;
  anchorB: Coordinates;
}

interface ForwardedRef {
  goToMyLocation: () => void;
  getCamera: () => Promise<Camera | undefined>;
}

const ClusteredMap = forwardRef<ForwardedRef>((props, ref) => {
  const mapRef = useRef<MapView>(null);
  const highlitedMarker = useAppSelector(selectHighlitedMarker);
  const mapType = useAppSelector(selectMapType);
  const [bounds, setBounds] = useState<BBox>(regionToBoundingBox(INITIAL_REGION));
  const [zoom, setZoom] = useState(10);
  const [myLocation, setIsOnMyLocation] = useState({
    isOnMyLocation: false,
    goToMyLocationWasCalled: false,
  });
  const { data: highlines, refetch } = trpc.marker.all.useQuery();

  useImperativeHandle(ref, () => ({
    goToMyLocation,
    getCamera,
  }));

  const goToMyLocation = async () => {
    const region = await getMyLocation();
    if (!region) return;
    setIsOnMyLocation({ isOnMyLocation: false, goToMyLocationWasCalled: true });
    mapRef.current?.animateToRegion(region, 1000);
  };

  const getCamera = async () => {
    return mapRef.current?.getCamera();
  };

  const onRegionChange = (_: Region, details: Details) => {
    // When onRegionChangeCompelete set myLocationState as true, the next region
    // change are detected and the state are setted as false
    if (myLocation.isOnMyLocation && myLocation.goToMyLocationWasCalled && details.isGesture) {
      setIsOnMyLocation({ isOnMyLocation: false, goToMyLocationWasCalled: false });
    }
  };

  const onRegionChangeComplete = async (region: Region, details: Details) => {
    const mapBound = regionToBoundingBox(region);
    const camera = await mapRef.current?.getCamera();
    setZoom(camera?.zoom ?? 10);
    setBounds(mapBound);
    // Set myLocation state as true when goToMyLocation animation ends
    if (!myLocation.isOnMyLocation && myLocation.goToMyLocationWasCalled && !details.isGesture) {
      setIsOnMyLocation({ isOnMyLocation: true, goToMyLocationWasCalled: true });
    }
  };

  const handleClusterPress = (cluster_id: number): void => {
    // Zoom to cluster
    const leaves = supercluster?.getLeaves(cluster_id);
    // leaves && fitMapToCoords(leaves?.map((l): Coordinates => l.properties.anchorB));
    leaves &&
      mapRef.current?.fitToCoordinates(
        leaves?.map((l): Coordinates => l.properties.anchorB),
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
  };

  const points = useMemo<PointFeature<GeoJsonProperties & PointProperties>[]>(() => {
    if (!highlines) return [];
    return highlines.map((h) => {
      // TO-DO: certify that has 2 elements and improve this logic
      // if (h.anchors.length != 2) return
      let anchorA;
      let anchorB;
      if (h.anchors[0].anchorSide === 'A') {
        anchorA = h.anchors[0];
        anchorB = h.anchors[1];
      } else {
        anchorA = h.anchors[1];
        anchorB = h.anchors[0];
      }

      return {
        type: 'Feature',
        properties: {
          cluster: false,
          category: 'highline',
          highId: h.uuid,
          anchorB: anchorB,
        },
        geometry: {
          type: 'Point',
          coordinates: [anchorA.longitude, anchorA.latitude],
        },
      };
    });
  }, [highlines, highlitedMarker?.shouldTriggerUseQueryRefetch]);

  const { clusters, supercluster } = useSuperCluster({
    points,
    bounds,
    zoom,
    options: { radius: 75, maxZoom: 25 },
  });

  // Handle marker highlightning
  useEffect(() => {
    if (highlitedMarker === null) return;
    if (highlitedMarker.shouldTriggerUseQueryRefetch) refetch();
    mapRef.current?.fitToCoordinates(highlitedMarker.coords, {
      edgePadding: {
        top: 200,
        right: 50,
        bottom: 250,
        left: 50,
      },
      animated: true,
    });
    setIsOnMyLocation({ isOnMyLocation: false, goToMyLocationWasCalled: false });
  }, [highlitedMarker]);

  return (
    <MapView
      className="flex-1"
      testID="MapView"
      provider="google"
      mapType={mapType}
      initialRegion={INITIAL_REGION}
      ref={mapRef}
      onMapReady={goToMyLocation}
      onRegionChange={onRegionChange}
      onRegionChangeComplete={onRegionChangeComplete}
      showsMyLocationButton={false}
      showsUserLocation>
      {clusters?.map((point) => {
        const [longitude, latitude] = point.geometry.coordinates;
        if (typeof longitude !== 'number' || typeof latitude !== 'number') return;
        const coordinateA = { latitude, longitude };
        const properties = point.properties;

        if (properties?.cluster) {
          const size = Math.max((properties.point_count * 40) / points.length, MIN_MARKER_SIZE);
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
          <HighlineMarker
            key={`marker-high-${properties.highId}`}
            id={properties.highId}
            coordinateA={coordinateA}
            coordinateB={properties.anchorB}
            isHighlited={highlitedMarker?.id === properties.highId}
          />
        );
      })}
    </MapView>
  );
});

ClusteredMap.displayName = 'ClusteredMap';

export default ClusteredMap;
