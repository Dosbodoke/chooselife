import { MapTypeSvg } from '@src/assets';
import { View, TouchableOpacity } from 'react-native';

interface Props {
  mBottom: number;
  onPress: () => void;
}

const MapType = ({ mBottom, onPress }: Props) => {
  return (
    <View className="absolute right-2 mb-16" style={{ bottom: mBottom }}>
      <TouchableOpacity
        className="h-12 w-12 rounded-full bg-gray-100 justify-center items-center"
        onPress={onPress}>
        <MapTypeSvg width="60%" height="60%" />
      </TouchableOpacity>
    </View>
  );
};

export default MapType;
