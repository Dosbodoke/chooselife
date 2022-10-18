import { View, Text, TouchableOpacity, LayoutChangeEvent } from 'react-native';

import { SearchSvg } from '../../assets';
import type { HomeScreenProps } from '../../navigation/types';
import LastHighline from '../LastHighline';
import useLastHighline from './useLastHighline';

type NavigationProp = HomeScreenProps['navigation'];

interface Props {
  handleLayoutChange: (event: LayoutChangeEvent) => void;
  navigation: NavigationProp;
}

const SearchCard = ({ handleLayoutChange, navigation }: Props) => {
  const lastHighline = useLastHighline();

  return (
    <View
      className="absolute w-full bottom-0 pb-8 px-2 bg-white rounded-t-3xl"
      onLayout={handleLayoutChange}>
      <TouchableOpacity
        className="bg-gray-100 rounded-xl my-4 py-3 px-2 flex-row items-center"
        onPress={() => navigation.navigate('Search')}>
        <SearchSvg />
        <Text className="ml-2 text-xl font-bold">Encontre um Highline</Text>
      </TouchableOpacity>

      <View>
        {lastHighline?.map((high) => (
          <LastHighline key={high.id} name={high.name} length={high.length} height={high.height} />
        ))}
      </View>
    </View>
  );
};

export default SearchCard;
