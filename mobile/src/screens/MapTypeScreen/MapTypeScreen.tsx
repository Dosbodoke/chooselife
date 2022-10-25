import { MapStandardPng, MapSatellitePng, MapTerrainPng } from '@src/assets';
import type { MapTypeScrenProps } from '@src/navigation/types';
import { useAppDispatch, useAppSelector } from '@src/redux/hooks';
import { setMapType, selectMapType } from '@src/redux/slices/mapSlice';
import { View, TouchableOpacity, Text, Image } from 'react-native';

const MapTypeScreen = ({ navigation }: MapTypeScrenProps) => {
  const mapType = useAppSelector(selectMapType);
  const dispatch = useAppDispatch();

  const highlitedImageStyle = 'border-blue-500 border-2';
  const highlitedTextStyle = 'text-blue-500';

  return (
    <View className="flex-1 justify-end relative">
      <View
        className="bg-black opacity-30 h-full w-full absolute"
        onTouchStart={() => navigation.goBack()}
        testID="goBack"
      />

      <View className="bg-white rounded-t-2xl pb-5">
        <Text className="text-center text-xl font-bold my-3">Tipo de mapa</Text>
        <View className="flex-row justify-around">
          <TouchableOpacity
            onPress={() => {
              dispatch(setMapType('standard'));
            }}>
            <Image
              className={`h-20 w-20 rounded-lg ${mapType === 'standard' && highlitedImageStyle}`}
              source={MapStandardPng}
            />
            <Text className={`text-center my-2 ${mapType === 'standard' && highlitedTextStyle}`}>
              Padrão
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => {
              dispatch(setMapType('satellite'));
            }}>
            <Image
              className={`h-20 w-20 rounded-lg ${mapType === 'satellite' && highlitedImageStyle}`}
              source={MapSatellitePng}
            />
            <Text className={`text-center my-2 ${mapType === 'satellite' && highlitedTextStyle}`}>
              Satélite
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => {
              dispatch(setMapType('terrain'));
            }}>
            <Image
              className={`h-20 w-20 rounded-lg ${mapType === 'terrain' && highlitedImageStyle}`}
              source={MapTerrainPng}
            />
            <Text className={`text-center my-2 ${mapType === 'terrain' && highlitedTextStyle}`}>
              Terreno
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

export default MapTypeScreen;
