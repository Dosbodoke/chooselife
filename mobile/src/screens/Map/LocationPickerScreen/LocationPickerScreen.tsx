import { HeartFilledSvg } from '@src/assets';
import { INITIAL_REGION } from '@src/constants';
import { LocationPickerScreenProps } from '@src/navigation/types';
import { useAppSelector } from '@src/redux/hooks';
import { useRef, useState } from 'react';
import { View, StatusBar, TouchableOpacity, Text } from 'react-native';
import MapView, { Region, Details, LatLng } from 'react-native-maps';

import { selectMapType } from '../mapSlice';
import { FakeMarker, LocationPickerTracer } from './components';

const LocationPickerScreen = ({ navigation, route }: LocationPickerScreenProps) => {
  const mapRef = useRef<MapView>(null);
  const mapType = useAppSelector(selectMapType);
  const [centerCoordinates, setCenterCoordinates] = useState<Region>();
  const [anchorA, setAnchorA] = useState<LatLng>();

  const onRegionChange = (region: Region, _: Details) => {
    setCenterCoordinates(region);
  };

  const handlePickLocation = async () => {
    const camera = await mapRef.current?.getCamera();
    setAnchorA(camera?.center);
  };

  async function onMapReady() {
    if (route.params.camera) mapRef.current?.setCamera(route.params.camera);
  }

  async function handleExit() {
    navigation.goBack();
  }

  return (
    <View className="relative h-full">
      <StatusBar barStyle="dark-content" />

      <MapView
        className="flex-1"
        provider="google"
        mapType={mapType}
        onRegionChange={anchorA && onRegionChange}
        onMapReady={onMapReady}
        initialRegion={INITIAL_REGION}
        ref={mapRef}
        showsMyLocationButton={false}
        showsUserLocation>
        {anchorA && centerCoordinates && (
          <LocationPickerTracer coordinate={centerCoordinates} anchorA={anchorA} />
        )}
      </MapView>
      <FakeMarker />
      <TouchableOpacity
        className="absolute left-3 top-12 bg-slate-500 w-8 h-8"
        onPress={handleExit}>
        <HeartFilledSvg />
      </TouchableOpacity>
      <TouchableOpacity
        className="absolute bottom-3 right-1/2 bg-slate-500 w-16 h-10"
        onPress={handlePickLocation}>
        <Text>PICK LOCATION</Text>
      </TouchableOpacity>
    </View>
  );
};

export default LocationPickerScreen;
