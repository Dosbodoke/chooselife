import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as Location from 'expo-location';
import { useState } from 'react';
import { View, Text, StatusBar, TouchableOpacity } from 'react-native';
import MapView, { Region } from 'react-native-maps';

import { RootStackParams } from '../../App';
import MyLocation from '../components/MyLocation';

type Props = NativeStackScreenProps<RootStackParams, 'Home'>;

const HomeScreen = ({ navigation }: Props) => {
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

  return (
    <View className="relative h-full">
      <StatusBar barStyle="dark-content" />

      <MapView className="flex-1" region={region} showsUserLocation provider="google" />

      <MyLocation onPress={handleMyLocation} />

      <View className="absolute w-full bottom-0 pb-2 bg-white rounded-t-3xl">
        <View className="h-full bg-white my-4 mx-2">
          <TouchableOpacity
            className="bg-gray-100 rounded-xl py-3 px-2"
            onPress={() => navigation.navigate('Search')}>
            <Text className="text-xl font-bold">Procurar por um Highline</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

export default HomeScreen;
