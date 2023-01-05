import { useRef, useState } from 'react';
import { View, StatusBar, LayoutChangeEvent } from 'react-native';
import { Camera } from 'react-native-maps';

import type { HomeScreenProps } from '../../../navigation/types';
import CardContainer from './components/Card/CardContainer';
import ClusteredMap from './components/ClusteredMap';
import MapType from './components/MapType';
import MyLocation from './components/MyLocation';

interface MapRef {
  goToMyLocation: () => void;
  getCamera: () => Promise<Camera | undefined>;
}

const HomeScreen = ({ navigation }: HomeScreenProps) => {
  const mapRef = useRef<MapRef>(null);
  const [marginBottom, setMarginBottom] = useState(0);

  const handleLayoutChange = (event: LayoutChangeEvent) => {
    const { height } = event.nativeEvent.layout;
    setMarginBottom(height);
  };

  async function handleNewLocation() {
    const camera = await mapRef.current?.getCamera();
    navigation.navigate('LocationPicker', { camera });
  }

  return (
    <View className="relative h-full">
      <StatusBar barStyle="dark-content" />

      <ClusteredMap ref={mapRef} />
      <MyLocation mBottom={marginBottom} onPress={() => mapRef.current?.goToMyLocation()} />
      <MapType mBottom={marginBottom} onPress={() => navigation.navigate('MapType')} />
      <CardContainer
        onLayout={handleLayoutChange}
        onNewLocation={handleNewLocation}
        navigation={navigation}
      />
    </View>
  );
};

export default HomeScreen;
