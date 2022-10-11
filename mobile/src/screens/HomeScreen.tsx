import * as Location from 'expo-location';
import { useState } from 'react';
import { View, StatusBar, LayoutChangeEvent, PixelRatio } from 'react-native';
import MapView, { Region } from 'react-native-maps';

import MyLocation from '../components/MyLocation';
import SearchCard from '../components/SearchCard/SearchCard';
import type { HomeScreenProps } from '../navigation/types';

const HomeScreen = ({ navigation }: HomeScreenProps) => {
  const [marginBottom, setMarginBottom] = useState(0);
  const [region, setRegion] = useState<Region>({
    latitude: -15.7782081,
    longitude: -47.93371,
    latitudeDelta: 5,
    longitudeDelta: 5,
  });

  const handleMyLocation = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return;

    const { latitude, longitude } = (await Location.getCurrentPositionAsync({})).coords;
    setRegion({
      latitude,
      longitude,
      latitudeDelta: 0.035,
      longitudeDelta: 0.035,
    });
  };

  const handleLayoutChange = (event: LayoutChangeEvent) => {
    const { height } = event.nativeEvent.layout;
    const rem = PixelRatio.getFontScale() * 16;
    setMarginBottom(height + rem * 2);
  };

  return (
    <View className="relative h-full">
      <StatusBar barStyle="dark-content" />

      <MapView className="flex-1" region={region} showsUserLocation provider="google" />

      <MyLocation mBottom={marginBottom} onPress={handleMyLocation} />

      <SearchCard handleLayoutChange={handleLayoutChange} navigation={navigation} />
    </View>
  );
};

export default HomeScreen;
