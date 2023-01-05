import { FakeMarkerSvg } from '@src/assets';
import { View, Text } from 'react-native';

interface Props {
  distance: number | undefined;
}

const FakeMarker = ({ distance }: Props) => {
  return (
    <View
      pointerEvents="none"
      className="absolute bottom-1/2 w-full flex items-center justify-center">
      {distance !== undefined && (
        <View className="bg-slate-600 rounded-md mb-1 py-1 px-2">
          <Text className="text-white">{distance}m</Text>
        </View>
      )}
      <FakeMarkerSvg />
    </View>
  );
};

export default FakeMarker;
