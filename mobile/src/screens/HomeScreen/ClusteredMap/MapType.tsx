import { useNavigation } from '@react-navigation/native';
import { MapTypeSvg } from '@src/assets';
import type { HomeScreenProps } from '@src/navigation/types';
import { View, TouchableOpacity } from 'react-native';

type NavigationProp = HomeScreenProps['navigation'];

interface Props {
  mBottom: number;
}

const MapType = ({ mBottom }: Props) => {
  const navigation = useNavigation<NavigationProp>();

  return (
    <View className="absolute right-2 mb-16" style={{ bottom: mBottom }}>
      <TouchableOpacity
        className="h-10 w-10 rounded-full bg-gray-100 justify-center items-center"
        onPress={() => {
          navigation.navigate('MapType');
        }}>
        <MapTypeSvg />
      </TouchableOpacity>
    </View>
  );
};

export default MapType;
