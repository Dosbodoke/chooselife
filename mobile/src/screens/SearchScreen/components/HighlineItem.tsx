import { View, Text, TouchableOpacity, Image } from 'react-native';

import { HeightSvg, LengthSvg } from '@src/assets';
import useIsFavorite from '@src/hooks/useIsFavorite';
import { RouterOutput } from '@src/utils/trpc';

type ExtractHighline<T> = T extends Array<infer U> ? U : never;

type HighlineArray = NonNullable<RouterOutput['highline']['getList']['items']>;
type HighlineOnly = ExtractHighline<HighlineArray>; // Highline

interface Props {
  highline: HighlineOnly;
  onPress: () => void;
}

const HighlineItem = ({ highline, onPress }: Props) => {
  const [HeartSvg, toggleFavorite] = useIsFavorite(highline.uuid);

  return (
    <TouchableOpacity
      onPress={onPress}
      className="my-1 flex w-full flex-row rounded-2xl bg-slate-50 p-2">
      <Image
        className="h-28 w-24 rounded-lg"
        source={{
          uri: 'https://naturalextremo.com/wp-content/uploads/2020/01/Virada-Esportiva-Highline-Natural-Extremo-@angelomaragno-@naturalextremobrasil-14-e1589735926438.jpg',
        }}
      />
      <View className="ml-1 flex-1">
        <Text className="text-lg font-bold">{highline.name}</Text>
        <Text className="text-gray-500">Chooselandia, Brasilia</Text>
        <View className="mt-2 flex flex-row items-center">
          <LengthSvg />
          <Text className="ml-1 text-gray-500">{highline?.height}</Text>
          <HeightSvg />
          <Text className="mr-1 text-gray-500">{highline?.length}</Text>
        </View>
        <View className="mt-auto flex flex-row items-end">
          <View
            className={`h-5 w-5 rounded-full ${highline.isRigged ? 'bg-green-400' : 'bg-red-500'}`}
          />
          <Text className="ml-1 font-semibold">{highline.isRigged ? 'Montada' : 'Desmontada'}</Text>
        </View>
      </View>
      <View className="flex-shrink-0 justify-center">
        <TouchableOpacity
          className="h-6 w-6 rounded-full bg-gray-100"
          onPress={() => toggleFavorite()}>
          {<HeartSvg strokeColor="#000" />}
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
};

export default HighlineItem;
