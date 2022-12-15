import { SearchSvg } from '@src/assets';
import type { HomeScreenProps } from '@src/navigation/types';
import { View, Text, TouchableOpacity } from 'react-native';

import LastHighline from './LastHighline';
import NewLocationButton from './NewLocationButton';
import useLastHighline from './useLastHighline';

type NavigationProp = HomeScreenProps['navigation'];

interface Props {
  onNewLocation: () => void;
  navigation: NavigationProp;
}

const SearchCard = ({ onNewLocation, navigation }: Props) => {
  const lastHighline = useLastHighline();

  return (
    <>
      <View className="flex flex-row items-center mb-4 gap-x-4">
        <TouchableOpacity
          className="flex-1 py-3 px-2 bg-gray-100 rounded-xl flex-row items-center shadow-md"
          onPress={() => navigation.navigate('Search')}>
          <SearchSvg />
          <Text className="ml-2 text-xl font-bold">Encontre um Highline</Text>
        </TouchableOpacity>
        <NewLocationButton onPress={onNewLocation} />
      </View>

      <View>
        {lastHighline?.map((high) => (
          <LastHighline key={high.id} highline={high} />
        ))}
      </View>
    </>
  );
};

export default SearchCard;
