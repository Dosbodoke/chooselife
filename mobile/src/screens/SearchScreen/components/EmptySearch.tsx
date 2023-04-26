import { View, Text } from 'react-native';
import React from 'react';

import { SearchSvg } from '@src/assets';

const EmptySearch = () => {
  return (
    <View className="flex h-48 flex-col items-center justify-center">
      <View className="mb-2 h-16 w-16">
        <SearchSvg strokeWidth={1} className="stroke-sky-600" />
      </View>
      <Text className="text-center text-base">Use a barra de busca para encontrar o seu</Text>
      <Text className="text-center text-base font-bold">Highline favorito</Text>
    </View>
  );
};

export default EmptySearch;
