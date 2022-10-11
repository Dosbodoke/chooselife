import { TouchableOpacity, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

function HistorySvg() {
  return (
    <Svg
      className="text-gray-400"
      width={24}
      height={24}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round">
      <Path d="M3 3v5h5" />
      <Path d="M3.05 13A9 9 0 106 5.3L3 8" />
      <Path d="M12 7v5l4 2" />
    </Svg>
  );
}

function HeightSvg() {
  return (
    <Svg className="text-gray-500" width="24px" height="24px" viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 22V2m0 20l-4-4m4 4l4-4M12 2L8 6m4-4l4 4"
        stroke="#6B7280"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function LengthSvg() {
  return (
    <Svg width="24px" height="24px" viewBox="0 0 24 24" fill="none">
      <Path
        d="M22 12H2m20 0l-4 4m4-4l-4-4M2 12l4 4m-4-4l4-4"
        stroke="#6B7280"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

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
