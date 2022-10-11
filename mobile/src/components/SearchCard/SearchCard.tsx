import { View, Text, TouchableOpacity, LayoutChangeEvent } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import type { HomeScreenProps } from '../../navigation/types';
import LastHighline from '../LastHighline';
import useLastHighline from './useLastHighline';

type NavigationProp = HomeScreenProps['navigation'];

interface Props {
  handleLayoutChange: (event: LayoutChangeEvent) => void;
  navigation: NavigationProp;
}

function SearchSvg() {
  return (
    <Svg
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={2.5}
      stroke="currentColor"
      className="w-6 h-6">
      <Path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
      />
    </Svg>
  );
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
        <Text className="ml-2 text-xl font-bold">Procurar por um Highline</Text>
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
