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
        className="h-10 w-10 rounded-full bg-gray-100 justify-center items-center"
        onPress={onPress}>
        <MyLocationSvg />
      </TouchableOpacity>
    </View>
  );
};

export default MyLocation;
