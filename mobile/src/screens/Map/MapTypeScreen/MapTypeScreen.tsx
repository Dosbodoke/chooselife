import { MapStandardPng, MapSatellitePng, MapTerrainPng } from '@src/assets';
import type { MapTypeScreenProps } from '@src/navigation/types';
import { useAppDispatch, useAppSelector } from '@src/redux/hooks';
import { View, Text } from 'react-native';

import { setMapType, selectMapType, MapType } from '../mapSlice';
import MapTypeButton from './components/MapTypeButton';

const MapTypeScreen = ({ navigation }: MapTypeScreenProps) => {
  const mapType = useAppSelector(selectMapType);
  const dispatch = useAppDispatch();

  function changeMapType(type: MapType) {
    dispatch(setMapType(type));
  }

  return (
    <View className="relative flex-1 justify-end">
      <View
        className="absolute h-full w-full bg-black opacity-30"
        onTouchStart={() => navigation.goBack()}
        testID="goBack"
      />

      <View className="rounded-t-2xl bg-white pb-5">
        <Text className="my-3 text-center text-xl font-bold">Tipo de mapa</Text>
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
