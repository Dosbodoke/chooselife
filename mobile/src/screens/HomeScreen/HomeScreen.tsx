import { useState } from 'react';
import { View, StatusBar, LayoutChangeEvent } from 'react-native';

import type { HomeScreenProps } from '../../navigation/types';
import CardContainer from './Card/CardContainer';
import MapContainer from './Map/MapContainer';

const HomeScreen = ({ navigation }: HomeScreenProps) => {
  const [marginBottom, setMarginBottom] = useState(0);

  const handleLayoutChange = (event: LayoutChangeEvent) => {
    const { height } = event.nativeEvent.layout;
    setMarginBottom(height);
  };

  return (
    <View className="relative h-full">
      <StatusBar barStyle="dark-content" />

      <MapContainer buttonMarginBottom={marginBottom} />
      <CardContainer handleLayoutChange={handleLayoutChange} navigation={navigation} />
    </View>
  );
};

export default HomeScreen;
