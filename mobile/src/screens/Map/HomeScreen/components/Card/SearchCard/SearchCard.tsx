import { SearchSvg } from '@src/assets';
import useLastHighline from '@src/hooks/useLastHighline';
import type { HomeScreenProps } from '@src/navigation/types';
import { View, Text, TouchableOpacity } from 'react-native';

import LastHighline from './LastHighline';
import NewLocationButton from './NewLocationButton';

type NavigationProp = HomeScreenProps['navigation'];

interface Props {
  onNewLocation: () => void;
  navigation: NavigationProp;
}

const SearchCard = ({ onNewLocation, navigation }: Props) => {
  const { lastHighline } = useLastHighline(true);

  return (
    <>
      <View className="mb-4 flex flex-row items-center gap-x-4">
        <TouchableOpacity
          className="flex-1 flex-row items-center rounded-xl bg-gray-100 py-3 px-2 shadow-md"
          onPress={() => navigation.navigate('Search')}>
          <View className="h-6 w-6">
            <SearchSvg className="stroke-sky-600" />
          </View>
          <Text className="ml-2 text-xl font-bold">Encontre um Highline</Text>
        </TouchableOpacity>
        <NewLocationButton onPress={onNewLocation} />
      </View>

      <View>
        {lastHighline?.map((high) => (
          <LastHighline key={high.uuid} highline={high} />
        ))}
      </View>
    </>
  );
};

export default SearchCard;
