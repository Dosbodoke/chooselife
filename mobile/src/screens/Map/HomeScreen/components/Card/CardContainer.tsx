import type { HomeScreenProps } from '@src/navigation/types';
import { useAppSelector } from '@src/redux/hooks';
import { LayoutChangeEvent, View } from 'react-native';

import { selectHighlitedMarker } from '../../../mapSlice';
import DetailCard from './DetailCard/DetailCard';
import SearchCard from './SearchCard/SearchCard';

type NavigationProp = HomeScreenProps['navigation'];

interface Props {
  onLayout: (event: LayoutChangeEvent) => void;
  onNewLocation: () => void;
  navigation: NavigationProp;
}

const CardContainer = ({ onLayout, onNewLocation, navigation }: Props) => {
  const highlitedMarker = useAppSelector(selectHighlitedMarker);

  return (
    <View
      className="absolute bottom-0 w-full rounded-t-3xl bg-white px-4 pb-8 pt-4"
      onLayout={onLayout}>
      {highlitedMarker ? (
        <DetailCard highlitedMarker={highlitedMarker} navigation={navigation} />
      ) : (
        <SearchCard navigation={navigation} onNewLocation={onNewLocation} />
      )}
    </View>
  );
};

export default CardContainer;
