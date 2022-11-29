import { MyLocationSvg } from '@src/assets';
import { View, TouchableOpacity } from 'react-native';

interface Props {
  mBottom: number;
  onPress: () => void;
  isOnMyLocation: boolean;
}

const MyLocation = ({ onPress, mBottom, isOnMyLocation }: Props) => {
  return (
    <View className="absolute right-2 mb-3" style={{ bottom: mBottom }}>
      <TouchableOpacity
        className="h-12 w-12 rounded-full bg-gray-100 justify-center items-center"
        onPress={onPress}>
        <MyLocationSvg width="80%" height="80%" fill={isOnMyLocation ? '#0284c7' : '#212121'} />
      </TouchableOpacity>
    </View>
  );
};

export default MyLocation;
