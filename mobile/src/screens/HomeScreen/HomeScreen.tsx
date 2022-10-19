import { useState } from 'react';
import { View, StatusBar, LayoutChangeEvent, PixelRatio } from 'react-native';

import SearchCard from '../../components/SearchCard/SearchCard';
import type { HomeScreenProps } from '../../navigation/types';
import ClusteredMapView from './ClusteredMapView';

const HomeScreen = ({ navigation }: HomeScreenProps) => {
  const [marginBottom, setMarginBottom] = useState(0);

  const handleLayoutChange = (event: LayoutChangeEvent) => {
    const { height } = event.nativeEvent.layout;
    const rem = PixelRatio.getFontScale() * 16;
    setMarginBottom(height + rem * 2);
  };

  return (
    <View className="relative h-full">
      <StatusBar barStyle="dark-content" />

      <ClusteredMapView buttonMarginBottom={marginBottom} />

      <SearchCard handleLayoutChange={handleLayoutChange} navigation={navigation} />
    </View>
  );
};

export default HomeScreen;
