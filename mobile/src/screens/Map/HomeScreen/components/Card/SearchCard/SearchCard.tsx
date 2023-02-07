import { useAsyncStorage } from '@react-native-async-storage/async-storage';
import { SearchSvg } from '@src/assets';
import type { HomeScreenProps } from '@src/navigation/types';
import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { z } from 'zod';

import LastHighline from './LastHighline';
import NewLocationButton from './NewLocationButton';

type NavigationProp = HomeScreenProps['navigation'];

export const highline = z
  .object({
    id: z.string(),
    name: z.string(),
    length: z.number(),
    height: z.number(),
    coords: z
      .array(
        z.object({
          latitude: z.number(),
          longitude: z.number(),
        })
      )
      .length(2),
  })
  .strict();

type Highline = z.infer<typeof highline>;

interface Props {
  onNewLocation: () => void;
  navigation: NavigationProp;
}

const SearchCard = ({ onNewLocation, navigation }: Props) => {
  const [lastHighline, setLastHighline] = useState<Highline[]>([]);
  const { getItem, removeItem } = useAsyncStorage('lastHighline');

  const readItemFromStorage = async () => {
    try {
      const item = await getItem();
      if (item !== null) {
        const parsed = JSON.parse(item);
        parsed.forEach((i: any) => highline.parse(i));
        setLastHighline(parsed);
      }
    } catch (error) {
      await removeItem();
      console.error(error);
    }
  };

  useEffect(() => {
    readItemFromStorage();
  }, []);

  return (
    <>
      <View className="mb-4 flex flex-row items-center gap-x-4">
        <TouchableOpacity
          className="flex-1 flex-row items-center rounded-xl bg-gray-100 py-3 px-2 shadow-md"
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
