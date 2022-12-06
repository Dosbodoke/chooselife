import { HistorySvg, HeightSvg, LengthSvg } from '@src/assets';
import type { Highline } from '@src/database';
import { useAppDispatch } from '@src/redux/hooks';
import { highlightMarker } from '@src/redux/slices/mapSlice';
import { TouchableOpacity, Text, View } from 'react-native';

interface Props {
  highline: Highline;
}

const LastHighline = ({ highline }: Props) => {
  const dispatch = useAppDispatch();

  const handleOnPress = () => {
    dispatch(
      highlightMarker({
        type: 'Highline',
        id: highline.id,
        coords: [highline.anchorA, highline.anchorB],
      })
    );
  };
  return (
    <TouchableOpacity onPress={handleOnPress} className="my-3 flex-row items-center gap-x-3 w-full">
      <View className="flex-shrink-0">
        <HistorySvg />
      </View>

      <Text className="flex-1" numberOfLines={1}>
        {highline.name}
      </Text>

      <View className="flex-shrink-0 flex-row items-center">
        <HeightSvg />
        <Text>{highline.height}m</Text>
      </View>
      <View className="flex-shrink-0 flex-row items-center gap-x-2">
        <LengthSvg />
        <Text>{highline.length}m</Text>
      </View>
    </TouchableOpacity>
  );
};

export default LastHighline;
