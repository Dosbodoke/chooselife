import { FakeMarker, LocationPickerTracer, selectLocationPicker } from '@features/locationPicker';
import { MIN_MARKER_SIZE, INITIAL_REGION } from '@src/constants';
import type { Coordinates } from '@src/database';
import database from '@src/database';
import { setPoint } from '@src/features/locationPicker/locationPickerSlice';
import { useAppDispatch, useAppSelector } from '@src/redux/hooks';
import { selectHighlitedMarker, selectMapType } from '@src/redux/slices/mapSlice';
import { BBox, GeoJsonProperties } from 'geojson';
import { useState, useRef, useMemo, useEffect } from 'react';
import MapView, { Details, LatLng, Region } from 'react-native-maps';
import { PointFeature } from 'supercluster';
import useSuperCluster from 'use-supercluster';

import { regionToBoundingBox, getMyLocation } from '../utils';
import MapType from './Buttons/MapType';
import MyLocation from './Buttons/MyLocation';
import ClusteredMarker from './Marker/ClusteredMarker';
import HighlineMarker from './Marker/HighlineMarker';

interface PointProperties {
  cluster: boolean;
  category: string;
  highId: string;
  anchorB: Coordinates;
}

interface Props {
  buttonMarginBottom: number;
}

const MapContainer = ({ buttonMarginBottom }: Props) => {
  const dispatch = useAppDispatch();
  const mapRef = useRef<MapView>(null);
  const highlitedMarker = useAppSelector(selectHighlitedMarker);
  const locationPicker = useAppSelector(selectLocationPicker);
  const mapType = useAppSelector(selectMapType);
  const [bounds, setBounds] = useState<BBox>(regionToBoundingBox(INITIAL_REGION));
  const [zoom, setZoom] = useState(10);
  const [centerCoordinates, setCenterCoordinates] = useState<LatLng>(INITIAL_REGION);
  const [myLocation, setIsOnMyLocation] = useState({
    isOnMyLocation: false,
    goToMyLocationWasCalled: false,
  });

  const goToMyLocation = async () => {
    const region = await getMyLocation();
    if (!region) return;
    setIsOnMyLocation({ isOnMyLocation: false, goToMyLocationWasCalled: true });
    mapRef.current?.animateToRegion(region, 1000);
  };

  const updateCenterCoordinates = async () => {
    const camera = await mapRef.current?.getCamera();
    camera && setCenterCoordinates(camera.center);
  };

  const onRegionChange = (_: Region, details: Details) => {
    // Update center coordinates if markerSetter is being displayed
    if (locationPicker.stage === 'picking') updateCenterCoordinates();

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

  const fitMapToCoords = (coords: Coordinates[]): void => {
    mapRef.current?.fitToCoordinates(coords, {
      edgePadding: {
        top: 200,
        right: 50,
        bottom: 250,
        left: 50,
      },
      animated: true,
    });
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

  const { clusters, supercluster } = useSuperCluster({
    points,
    bounds,
    zoom,
    options: { radius: 75, maxZoom: 25 },
  });

  // Handle marker highlightning
  useEffect(() => {
    if (highlitedMarker === null) return;
    fitMapToCoords(highlitedMarker.coords);
    setIsOnMyLocation({ isOnMyLocation: false, goToMyLocationWasCalled: false });
  }, [highlitedMarker]);

  // Set center coordinates when Add Marker button is clicked
  useEffect(() => {
    if (locationPicker.stage === 'picking') updateCenterCoordinates();
    if (locationPicker.shouldCallSetPoint) dispatch(setPoint(centerCoordinates));
  }, [locationPicker]);

  return (
    <>
      <MapView
        className="flex-1"
        testID="MapView"
        provider="google"
        mapType={mapType}
        initialRegion={INITIAL_REGION}
        ref={mapRef}
        onMapReady={() => goToMyLocation()}
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

        {locationPicker.stage === 'picking' && locationPicker.anchorA && (
          <LocationPickerTracer
            key="location-picker"
            anchorA={locationPicker.anchorA}
            coordinate={centerCoordinates}
          />
        )}
      </MapView>
      {locationPicker.stage === 'picking' && <FakeMarker />}
      <MyLocation
        mBottom={buttonMarginBottom}
        onPress={goToMyLocation}
        isOnMyLocation={myLocation.isOnMyLocation}
      />
      <MapType mBottom={buttonMarginBottom} />
    </>
  );
};

export default MapContainer;
