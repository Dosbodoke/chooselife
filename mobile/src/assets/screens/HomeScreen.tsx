import * as Location from 'expo-location';
import { useState } from 'react';
import { View, Text, Dimensions, StyleSheet, Button } from 'react-native';
import MapView, { Region } from 'react-native-maps';

const HomeScreen = () => {
  const [region, setRegion] = useState<Region>({
    latitude: -15.7782081,
    longitude: -47.93371,
    latitudeDelta: 5,
    longitudeDelta: 5,
  });
  const [errorMsg, setErrorMsg] = useState('');

  const handleMyLocation = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      setErrorMsg('Permission to access location was denied');
      return;
    }

    const { latitude, longitude } = (await Location.getCurrentPositionAsync({})).coords;
    setRegion({
      latitude,
      longitude,
      latitudeDelta: 0.035,
      longitudeDelta: 0.035,
    });
    setRegion((prev) => ({ ...prev, latitude, longitude }));
  };

  return (
    <View style={{ position: 'relative' }}>
      {errorMsg && <Text>{errorMsg}</Text>}
      <View style={{ position: 'absolute' }}>
        <Button onPress={handleMyLocation} title="My location" color="#606060"/>
      </View>
      <MapView style={styles.map} region={region} showsUserLocation provider="google" />
    </View>
  );
};

const styles = StyleSheet.create({
  map: {
    position: 'absolute',
    width: Dimensions.get('screen').width,
    height: Dimensions.get('screen').height,
  },
});

export default HomeScreen;
