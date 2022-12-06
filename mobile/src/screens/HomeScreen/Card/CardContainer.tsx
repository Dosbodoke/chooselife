import type { HomeScreenProps } from '@src/navigation/types';
import { useAppSelector } from '@src/redux/hooks';
import { selectHighlitedMarker } from '@src/redux/slices/mapSlice';
import { LayoutChangeEvent } from 'react-native';

import DetailCard from './DetailCard/DetailCard';
import SearchCard from './SearchCard/SearchCard';

type NavigationProp = HomeScreenProps['navigation'];

interface Props {
  handleLayoutChange: (event: LayoutChangeEvent) => void;
  navigation: NavigationProp;
}

const CardContainer = ({ handleLayoutChange, navigation }: Props) => {
  const highlitedMarker = useAppSelector(selectHighlitedMarker);

  if (highlitedMarker)
    return (
      <DetailCard
        highlitedMarker={highlitedMarker}
        handleLayoutChange={handleLayoutChange}
        navigation={navigation}
      />
    );

  return <SearchCard handleLayoutChange={handleLayoutChange} navigation={navigation} />;
};

export default CardContainer;
