import { useAppSelector } from '@src/redux/hooks';
import { selectHighlitedMarker } from '@src/redux/slices/mapSlice';
import { useState } from 'react';
import { View, StatusBar, LayoutChangeEvent } from 'react-native';

import type { HomeScreenProps } from '../../navigation/types';
import ClusteredMap from './ClusteredMap/ClusteredMap';
import DetailCard from './DetailCard/DetailCard';
import SearchCard from './SearchCard/SearchCard';

const HomeScreen = ({ navigation }: HomeScreenProps) => {
  const [marginBottom, setMarginBottom] = useState(0);
  const highlitedMarker = useAppSelector(selectHighlitedMarker);

  const handleLayoutChange = (event: LayoutChangeEvent) => {
    const { height } = event.nativeEvent.layout;
    setMarginBottom(height);
  };

  return (
    <View className="relative h-full">
      <StatusBar barStyle="dark-content" />

      <ClusteredMap buttonMarginBottom={marginBottom} />

      {highlitedMarker ? (
        <DetailCard handleLayoutChange={handleLayoutChange} highlitedMarker={highlitedMarker} />
      ) : (
        <SearchCard handleLayoutChange={handleLayoutChange} navigation={navigation} />
      )}
    </View>
  );
};

export default HomeScreen;
