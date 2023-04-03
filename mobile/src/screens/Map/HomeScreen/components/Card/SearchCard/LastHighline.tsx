import { HistorySvg, HeightSvg, LengthSvg } from '@src/assets';
import { useAppDispatch } from '@src/redux/hooks';
import { TouchableOpacity, Text, View } from 'react-native';

import { highlightMarker } from '../../../../mapSlice';
import { type StorageHighline } from '@src/hooks/useLastHighline';

interface Props {
  highline: StorageHighline;
}

const LastHighline = ({ highline }: Props) => {
  const dispatch = useAppDispatch();

  const handleOnPress = () => {
    dispatch(
      highlightMarker({
        type: 'Highline',
        id: highline.id,
        coords: highline.coords,
      })
    );
  };

  return (
    <TouchableOpacity onPress={handleOnPress} className="my-3 w-full flex-row items-center gap-x-3">
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
