import { useRouter } from 'expo-router';
import React, { useRef, useState } from 'react';
import { View } from 'react-native';
import MapView, {
  LatLng,
  Marker,
  Polyline,
  PROVIDER_GOOGLE,
} from 'react-native-maps';

import FakeMarker from '~/components/map/fake-marker';
import { PickerControls } from '~/components/map/picker-button';

const LocationPickerScreen: React.FC = () => {
  const mapRef = useRef<MapView>(null);
  const router = useRouter();

  const [anchorA, setAnchorA] = useState<LatLng | null>(null);
  const [anchorB, setAnchorB] = useState<LatLng | null>(null);
  const [centerCoordinates, setCenterCoordinates] = useState<LatLng>();

  function onMapReady() {
    // if (route.params.camera) mapRef.current?.setCamera(route.params.camera);
  }

  const handlePickLocation = React.useCallback(async () => {
    const camera = await mapRef.current?.getCamera();
    const center = camera?.center;
    if (!center) return;
    if (!anchorA) {
      setAnchorA(center);
      return;
    }
    if (!anchorB) {
      setAnchorB(center);
      return;
    }
  }, [anchorA, anchorB]);

  const handleUndoPickLocation = React.useCallback(() => {
    if (anchorB) {
      setAnchorB(null);
      return;
    }
    if (anchorA) {
      setAnchorA(null);
      return;
    }
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace('/(tabs)');
  }, [anchorA, anchorB, router]);

  const stage = React.useMemo(() => {
    if (!anchorA) return 'initial';
    if (!anchorB) return 'partial';
    return 'final';
  }, [anchorA, anchorB]);

  return (
    <View className="relative h-full">
      <MapView
        style={{ width: '100%', height: '100%' }}
        provider={PROVIDER_GOOGLE}
        mapType="satellite"
        onRegionChange={(region) => setCenterCoordinates(region)}
        onMapReady={onMapReady}
        // initialRegion={INITIAL_REGION}
        ref={mapRef}
        showsMyLocationButton={false}
        showsUserLocation
      >
        {anchorA && (
          <Marker
            draggable
            onDragEnd={(e) => setAnchorA(e.nativeEvent.coordinate)}
            coordinate={anchorA}
            //   icon={icon}
          />
        )}
        {anchorB && (
          <Marker
            coordinate={anchorB}
            // icon={icon}
          />
        )}
        {anchorA && (anchorB || centerCoordinates) ? (
          <Polyline
            coordinates={[anchorA, anchorB || centerCoordinates]}
            strokeWidth={2}
            strokeColor="#000"
          />
        ) : null}
      </MapView>

      {!anchorA || !anchorB ? (
        <FakeMarker
          distance={100}
          //   distance={
          //     markers[0] && centerCoordinates
          //       ? getDistance(markers[0], centerCoordinates)
          //       : undefined
          //   }
        />
      ) : null}

      <PickerControls
        onPick={handlePickLocation}
        onUndo={handleUndoPickLocation}
        stage={stage}
      />
    </View>
  );
};

export default LocationPickerScreen;
