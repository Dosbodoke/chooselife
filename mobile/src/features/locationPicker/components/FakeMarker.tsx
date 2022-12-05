import { FakeMarkerSvg } from '@src/assets';
import { View } from 'react-native';

const FakeMarker = () => {
  return (
    <View className="absolute right-1/2 bottom-1/2 translate-x-4 translate-y-2">
      <FakeMarkerSvg />
    </View>
  );
};

export default FakeMarker;
