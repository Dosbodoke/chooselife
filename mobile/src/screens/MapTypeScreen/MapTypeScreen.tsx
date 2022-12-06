import { MapStandardPng, MapSatellitePng, MapTerrainPng } from '@src/assets';
import type { MapTypeScreenProps } from '@src/navigation/types';
import { useAppDispatch, useAppSelector } from '@src/redux/hooks';
import { setMapType, selectMapType, MapType } from '@src/redux/slices/mapSlice';
import { View, Text } from 'react-native';

import MapTypeButton from './components/MapTypeButton';

const MapTypeScreen = ({ navigation }: MapTypeScreenProps) => {
  const mapType = useAppSelector(selectMapType);
  const dispatch = useAppDispatch();

  function changeMapType(type: MapType) {
    dispatch(setMapType(type));
  }

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
          <MapTypeButton
            selectedType={mapType}
            type="standard"
            image={MapStandardPng}
            title="Padrão"
            onPress={() => changeMapType('standard')}
          />

          <MapTypeButton
            selectedType={mapType}
            type="satellite"
            image={MapSatellitePng}
            title="Satélite"
            onPress={() => changeMapType('satellite')}
          />

          <MapTypeButton
            selectedType={mapType}
            type="terrain"
            image={MapTerrainPng}
            title="Terreno"
            onPress={() => changeMapType('terrain')}
          />
        </View>
      </View>
    </View>
  );
};

export default MapTypeScreen;
