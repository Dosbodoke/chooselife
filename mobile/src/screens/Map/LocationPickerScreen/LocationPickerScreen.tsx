import { ArrowBackCircleSvg } from '@src/assets';
import { INITIAL_REGION } from '@src/constants';
import { LocationPickerScreenProps } from '@src/navigation/types';
import { useAppSelector } from '@src/redux/hooks';
import { LinearGradient } from 'expo-linear-gradient';
import { getDistance } from 'geolib';
import { useRef, useState } from 'react';
import { View, StatusBar, TouchableOpacity, Text } from 'react-native';
import MapView, { Region, Details, LatLng } from 'react-native-maps';

import { selectMapType } from '../mapSlice';
import { FakeMarker, LocationPickerTracer } from './components';

const LocationPickerScreen = ({ navigation, route }: LocationPickerScreenProps) => {
  const mapRef = useRef<MapView>(null);
  const mapType = useAppSelector(selectMapType);
  const [centerCoordinates, setCenterCoordinates] = useState<Region>();
  const [firstMarker, setFirstMarker] = useState<LatLng>();

  const isLastMarker = firstMarker && centerCoordinates;

  const onRegionChange = (region: Region, _: Details) => {
    setCenterCoordinates(region);
  };

  async function handlePickLocation() {
    if (isLastMarker) {
      console.log('SET MARKER'); // TO-DO: Next step, get form info
    } else {
      const camera = await mapRef.current?.getCamera();
      setFirstMarker(camera?.center);
    }
  }

  function onMapReady() {
    if (route.params.camera) mapRef.current?.setCamera(route.params.camera);
  }

  return (
    <View className="relative h-full">
      <StatusBar barStyle="dark-content" />
      <MapView
        className="flex-1"
        provider="google"
        mapType={mapType}
        onRegionChange={firstMarker && onRegionChange}
        onMapReady={onMapReady}
        initialRegion={INITIAL_REGION}
        ref={mapRef}
        showsMyLocationButton={false}
        showsUserLocation>
        {isLastMarker && <LocationPickerTracer center={centerCoordinates} anchorA={firstMarker} />}
      </MapView>

      <FakeMarker
        distance={isLastMarker ? getDistance(firstMarker, centerCoordinates) : undefined}
      />

      <TouchableOpacity
        className="absolute left-3 top-12 w-12 h-12 bg-gray-600 rounded-full"
        onPress={() => navigation.goBack()}>
        <ArrowBackCircleSvg color="#e7e5e4" className="fill-neutral-200" />
      </TouchableOpacity>

      <TouchableOpacity
        className="absolute bottom-8 left-1/2  trasnform -translate-x-28"
        onPress={handlePickLocation}>
        {isLastMarker ? (
          <LinearGradient
            className="w-56 h-10 rounded-lg px-5 py-2.5 mr-2 mb-2"
            colors={['#4caf50', '#2196f3']}
            start={{ x: -1, y: 1 }}
            end={{ x: 3, y: 4 }}>
            <Text className="text-white font-bold text-center">DEFINIR ANCORAGEM B</Text>
          </LinearGradient>
        ) : (
          <LinearGradient
            className="w-56 h-10 rounded-lg px-5 py-2.5 mr-2 mb-2"
            colors={['#4caf50', '#2196f3']}
            start={{ x: -1, y: 1 }}
            end={{ x: 3, y: 4 }}>
            <Text className="text-white font-bold text-center">DEFINIR ANCORAGEM A</Text>
          </LinearGradient>
        )}
      </TouchableOpacity>
    </View>
  );
};

export default LocationPickerScreen;
