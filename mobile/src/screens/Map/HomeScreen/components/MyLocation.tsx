import { MyLocationSvg } from '@src/assets';
import { View, TouchableOpacity } from 'react-native';

interface Props {
  mBottom: number;
  onPress: () => void;
}

const MyLocation = ({ onPress, mBottom }: Props) => {
  return (
    <View className="absolute right-2 mb-3" style={{ bottom: mBottom }}>
      <TouchableOpacity
        className="h-12 w-12 items-center justify-center rounded-full bg-gray-100"
        onPress={onPress}>
        <MyLocationSvg width="80%" height="80%" fill="#212121" />
      </TouchableOpacity>
    </View>
  );
};

export default MyLocation;
