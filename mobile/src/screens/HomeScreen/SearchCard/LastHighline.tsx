import { HistorySvg, HeightSvg, LengthSvg } from '@src/assets';
import { TouchableOpacity, Text, View } from 'react-native';

// import { HistorySvg, HeightSvg, LengthSvg } from '../../../assets';

interface Props {
  name: string;
  length: number;
  height: number;
}

const LastHighline = (props: Props) => {
  return (
    <TouchableOpacity className="my-3 flex-row items-center gap-x-3 w-full">
      <View className="flex-shrink-0">
        <HistorySvg />
      </View>

      <Text className="flex-1" numberOfLines={1}>
        {props.name}
      </Text>

      <View className="flex-shrink-0 flex-row items-center">
        <HeightSvg />
        <Text>{props.height}m</Text>
      </View>
      <View className="flex-shrink-0 flex-row items-center gap-x-2">
        <LengthSvg />
        <Text>{props.length}m</Text>
      </View>
    </TouchableOpacity>
  );
};

export default LastHighline;
