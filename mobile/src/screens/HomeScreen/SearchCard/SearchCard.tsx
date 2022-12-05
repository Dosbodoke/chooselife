import { LocationPickerButton } from '@features/locationPicker';
import { SearchSvg } from '@src/assets';
import type { HomeScreenProps } from '@src/navigation/types';
import { View, Text, TouchableOpacity, LayoutChangeEvent } from 'react-native';

import LastHighline from './LastHighline';
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
      className="absolute w-full bottom-0 pb-8 pt-4 px-2 bg-white rounded-t-3xl"
      onLayout={handleLayoutChange}>
      <View className="flex flex-row items-center mb-4 gap-2">
        <TouchableOpacity
          className="bg-gray-100 rounded-xl py-3 px-2 flex-row items-center flex-1"
          onPress={() => navigation.navigate('Search')}>
          <SearchSvg />
          <Text className="ml-2 text-xl font-bold">Encontre um Highline</Text>
        </TouchableOpacity>
        <LocationPickerButton />
      </View>

      <View>
        {lastHighline?.map((high) => (
          <LastHighline key={high.id} highline={high} />
        ))}
      </View>
    </View>
  );
};

export default SearchCard;
