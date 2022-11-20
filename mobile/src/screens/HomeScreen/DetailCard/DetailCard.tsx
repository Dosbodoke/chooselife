import { HeartFilledSvg, HeartOutlinedSvg } from '@src/assets';
import database from '@src/database';
import { HighlitedMarker } from '@src/redux/slices/mapSlice';
import { useState } from 'react';
import { View, Text, LayoutChangeEvent, Image, ScrollView } from 'react-native';
import { TouchableOpacity } from 'react-native-gesture-handler';

interface Props {
  handleLayoutChange: (event: LayoutChangeEvent) => void;
  highlitedMarker: HighlitedMarker;
}

const DetailCard = ({ highlitedMarker, handleLayoutChange }: Props) => {
  const data = database.highline.find((high) => high.id === highlitedMarker.id);
  const [isFavorite, setIsFavorite] = useState(false);
  const conquerors = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

  return (
    <View
      className="absolute w-full bottom-0 pb-8 px-4 bg-white rounded-t-3xl"
      onLayout={handleLayoutChange}>
      <View className="w-2/5 h-2 bg-slate-200 rounded-md mx-auto my-2" />
      <View className="flex flex-row ">
        <Image
          className="w-2/6 h-40 rounded-lg object-contain"
          source={{
            uri: 'https://naturalextremo.com/wp-content/uploads/2020/01/Virada-Esportiva-Highline-Natural-Extremo-@angelomaragno-@naturalextremobrasil-14-e1589735926438.jpg',
          }}
        />
        <View className="flex-1 ml-2">
          <View className="flex flex-row">
            <View className="flex-1">
              <Text className="text-xl font-extrabold">{data?.name}</Text>
              <Text className="text-gray-500">altura: {data?.length}</Text>
              <Text className="text-gray-500">comprimento: {data?.height}</Text>
            </View>
            <View>
              <TouchableOpacity className="w-6 h-6" onPress={() => setIsFavorite(!isFavorite)}>
                {isFavorite ? <HeartFilledSvg /> : <HeartOutlinedSvg />}
              </TouchableOpacity>
              <View
                className={`mt-2 w-6 h-6 rounded-full ${
                  data?.isRigged ? 'bg-green-500' : 'bg-red-500'
                }`}
              />
            </View>
          </View>
          <View>
            <Text className="text-lg font-bold mt-2">Conquistadores</Text>
            <ScrollView horizontal className="py-2">
              {conquerors.length &&
                conquerors.map((conquerer, idx) => (
                  <TouchableOpacity
                    key={conquerer}
                    className="w-12 h-12 rounded-full bg-slate-800 mr-1"
                  />
                ))}
            </ScrollView>
          </View>
        </View>
      </View>
    </View>
  );
};

export default DetailCard;
