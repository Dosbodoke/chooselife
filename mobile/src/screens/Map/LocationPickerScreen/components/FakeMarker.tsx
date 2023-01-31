import { FakeMarkerSvg } from '@src/assets';
import { View, Text } from 'react-native';

interface Props {
  distance: number | undefined;
}

const FakeMarker = ({ distance }: Props) => {
  return (
    <View
      pointerEvents="none"
      className="absolute bottom-1/2 flex w-full items-center justify-center">
      {distance !== undefined && (
        <View className="mb-1 rounded-md bg-slate-600 py-1 px-2">
          <Text className="text-white">{distance}m</Text>
        </View>
      )}
      <FakeMarkerSvg />
    </View>
  );
};

export default FakeMarker;
